CREATE SCHEMA accounting;

CREATE TABLE accounting.partners (
    id uuid PRIMARY KEY, source_account text NOT NULL, source_id text NOT NULL,
    title text NOT NULL, kind text, details jsonb NOT NULL,
    UNIQUE (source_account, source_id)
);
CREATE INDEX partners_external ON accounting.partners (source_account, lower(source_id));
CREATE INDEX partners_name ON accounting.partners (source_account, lower(trim(title)));

CREATE TABLE accounting.references (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_account text NOT NULL,kind text NOT NULL,
    source_id text NOT NULL,title text NOT NULL, UNIQUE(source_account,kind,source_id)
);

CREATE TABLE accounting.documents (
    id uuid PRIMARY KEY, source_account text NOT NULL, source_id text NOT NULL,
    entity_type text NOT NULL, kind text, number text, day date, status text,
    organization_id text, organization text, store_ids text[] NOT NULL,
    partner_ref text, partner_title text, agreement_ref text, agreement text,
    parent_ref text, parent_kind text, currency text, total numeric, details jsonb NOT NULL,
    native_partner_id uuid REFERENCES accounting.partners(id), native_org_id uuid REFERENCES accounting.references(id),
    native_store_id uuid REFERENCES accounting.references(id), UNIQUE (source_account, source_id, entity_type)
);
CREATE INDEX documents_register ON accounting.documents (entity_type, kind, day DESC, id);
CREATE INDEX documents_partner ON accounting.documents (source_account, lower(partner_ref));
CREATE INDEX documents_reference ON accounting.documents (source_account, lower(source_id), kind);
CREATE INDEX documents_parent ON accounting.documents (source_account, lower(parent_ref), parent_kind);

CREATE VIEW accounting.document_register AS
SELECT d.id,d.entity_type,d.kind,d.number,d.day,d.status,d.source_account,d.source_id,
       d.organization,d.organization_id,d.partner_title,d.partner_ref,coalesce(d.native_partner_id,p.id) AS partner_id,d.agreement,
       d.currency,d.total::text AS amount,d.parent_ref,d.parent_kind
FROM accounting.documents d
LEFT JOIN LATERAL (
    SELECT (array_agg(p.id))[1] AS id FROM accounting.partners p
    WHERE p.source_account=d.source_account AND lower(p.source_id)=lower(d.partner_ref)
    HAVING count(*)=1
) p ON true;

CREATE TABLE accounting.balance_reports (
    id uuid PRIMARY KEY, source_account text NOT NULL, source_id text NOT NULL,
    day date, captured_at text, details jsonb NOT NULL, UNIQUE (source_account, source_id)
);
CREATE TABLE accounting.balance_partner_links (
    report_id uuid NOT NULL REFERENCES accounting.balance_reports(id),heading_position bigint NOT NULL,
    partner_id uuid NOT NULL REFERENCES accounting.partners(id),PRIMARY KEY(report_id,heading_position)
);

-- The same projection runs for the initial transfer and every later import.
CREATE FUNCTION accounting.copy_record(r integration.dntrade_archive_records) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE body jsonb;
BEGIN
    IF r.entity_type NOT IN ('store','partner','invoice','order','debtAdjustment','receipt','customerReturn','bankPayment','cashOrder')
       AND NOT (r.entity_type = 'financialReport' AND
                r.document_type IS NOT DISTINCT FROM 'Взаєморозрахунки з контрагентами') THEN RETURN; END IF;
    body := r.payload::jsonb->'raw';
    IF r.entity_type = 'store' THEN
        INSERT INTO accounting.references(source_account,kind,source_id,title)
            VALUES(r.source_account,'store',lower(r.source_id),coalesce(body->>'title',r.source_id))
            ON CONFLICT (source_account,kind,source_id) DO NOTHING;
    ELSIF r.entity_type = 'partner' THEN
        INSERT INTO accounting.partners VALUES
            (r.id,r.source_account,r.source_id,coalesce(nullif(body->>'title',''),r.source_id),r.document_type,body);
    ELSIF r.entity_type = 'financialReport' THEN
        INSERT INTO accounting.balance_reports VALUES
            (r.id,r.source_account,r.source_id,r.source_day,body->>'capturedAt',body);
    ELSE
        IF nullif(r.organization_id,'') IS NOT NULL AND nullif(body#>>'{organization,title}','') IS NOT NULL THEN
            INSERT INTO accounting.references(source_account,kind,source_id,title)
                VALUES(r.source_account,'organization',lower(r.organization_id),body#>>'{organization,title}')
                ON CONFLICT (source_account,kind,source_id) DO NOTHING;
        END IF;
        INSERT INTO accounting.documents VALUES
            (r.id,r.source_account,r.source_id,r.entity_type,r.document_type,body->>'number',r.source_day,r.status,
             r.organization_id,body#>>'{organization,title}',r.store_ids,
             nullif(body#>>'{partner,external_id}',''),body#>>'{partner,title}',
             body#>>'{agreement,external_id}',body#>>'{agreement,title}',
             nullif(body#>>'{parent_document,external_id}',''),body#>>'{parent_document,type}',
             r.currency,r.total,body);
    END IF;
END $$;
CREATE FUNCTION accounting.import_archive_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM accounting.copy_record(NEW);
    RETURN NEW;
END $$;
-- Lock before reading the existing records so a concurrent import is included exactly once.
LOCK TABLE integration.dntrade_archive_records IN SHARE ROW EXCLUSIVE MODE;
CREATE TRIGGER accounting_register_import AFTER INSERT ON integration.dntrade_archive_records
    FOR EACH ROW EXECUTE FUNCTION accounting.import_archive_record();
DO $$ DECLARE r integration.dntrade_archive_records;
BEGIN
    FOR r IN SELECT * FROM integration.dntrade_archive_records WHERE entity_type IN
        ('store','partner','invoice','order','debtAdjustment','receipt','customerReturn','bankPayment','cashOrder','financialReport')
    LOOP PERFORM accounting.copy_record(r); END LOOP;
END $$;

CREATE VIEW accounting.document_lines AS
SELECT d.id AS document_id, item.ordinality AS position, item.value#>>'{product,id}' AS product_ref,
       item.value#>>'{product,title}' AS product, item.value#>>'{product,sku}' AS sku,
       item.value#>>'{store,external_id}' AS store_ref, item.value#>>'{store,title}' AS store,
       item.value->>'quantity' AS quantity, item.value->>'price' AS price,
       item.value->>'total' AS total, item.value AS details,
       coalesce(native_product.id,imported_product.id) AS catalog_id
FROM accounting.documents d
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
    THEN d.details->'products' ELSE '[]' END) WITH ORDINALITY AS item(value,ordinality)
LEFT JOIN catalog.products imported_product ON d.source_account='valko-dntrade'
    AND imported_product.navkolo_id='dntrade-code:' || (item.value#>>'{product,code}')
LEFT JOIN catalog.products native_product ON d.native_partner_id IS NOT NULL
    AND native_product.id::text=item.value#>>'{product,id}';

-- The first displayed line carries the UAH amount. Preserve all original currency lines in details.
CREATE FUNCTION accounting.uah_amount(v text) RETURNS numeric LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE WHEN line ~ '^[-+−]?([0-9]+|[0-9]{1,3}([   ][0-9]{3})+)[,.][0-9]{2}[   ]*грн[.]$'
        THEN translate(regexp_replace(line,'грн[.]$',''),',−   ','.-')::numeric END
        FROM (SELECT trim(split_part(v,chr(10),1)) AS line) t
$$;

CREATE VIEW accounting.settlements AS
WITH rows AS (
    SELECT b.id AS report_id,b.source_account,b.source_id,b.day,b.captured_at,
           e.ordinality AS position,e.value AS raw_row,e.value->>'section' AS section,
           nullif(e.value->>'level','') AS indent,e.value#>>'{cells,0,value}' AS label
    FROM accounting.balance_reports b
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(b.details#>'{tables,0}')='array'
        THEN b.details#>'{tables,0}' ELSE '[]' END) WITH ORDINALITY e(value,ordinality)
), grouped AS (
    SELECT *,max(position) FILTER (WHERE section='TBODY' AND indent IS NULL)
        OVER (PARTITION BY report_id ORDER BY position) AS heading FROM rows
)
SELECT g.report_id,g.source_account,g.source_id,g.day,g.captured_at,g.position,g.heading AS heading_position,
       g.section='TFOOT' AS footer, h.label AS partner_title,g.label AS account,
       accounting.uah_amount(g.raw_row#>>'{cells,1,value}') AS opening,
       accounting.uah_amount(g.raw_row#>>'{cells,2,value}') AS incoming,
       accounting.uah_amount(g.raw_row#>>'{cells,3,value}') AS outgoing,
       accounting.uah_amount(g.raw_row#>>'{cells,4,value}') AS closing,
       ARRAY[g.raw_row#>>'{cells,1,value}',g.raw_row#>>'{cells,2,value}',g.raw_row#>>'{cells,3,value}',g.raw_row#>>'{cells,4,value}'] AS source_amounts
FROM grouped g LEFT JOIN rows h ON h.report_id=g.report_id AND h.position=g.heading
WHERE g.section='TFOOT' OR (g.section='TBODY' AND g.indent IS NOT NULL);
