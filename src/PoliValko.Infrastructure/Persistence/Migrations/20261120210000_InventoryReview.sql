CREATE TABLE accounting.inventory_reports (
    id uuid PRIMARY KEY REFERENCES integration.dntrade_archive_records(id), source_account text NOT NULL,
    source_id text NOT NULL, day date, kind text NOT NULL, store_ref text, store_name text,
    series text NOT NULL, declared_count integer, first_row integer
);
CREATE INDEX inventory_report_series ON accounting.inventory_reports(source_account,series);
CREATE TABLE accounting.inventory_lines (
    report_id uuid REFERENCES accounting.inventory_reports(id), position integer NOT NULL, series_row integer,
    code text, title text, unit text, quantity_text text, quantity numeric, booked numeric, consistent boolean,
    PRIMARY KEY(report_id,position)
);
CREATE TABLE accounting.inventory_confirmations (
    report_id uuid, position integer, opening_id uuid UNIQUE NOT NULL REFERENCES accounting.stock_openings(id),
    source_account text NOT NULL, store_id uuid NOT NULL, product_id uuid NOT NULL,
    PRIMARY KEY(report_id,position), FOREIGN KEY(report_id,position) REFERENCES accounting.inventory_lines(report_id,position),
    UNIQUE(source_account,store_id,product_id)
);
CREATE FUNCTION accounting.stock_number(v text) RETURNS numeric LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE WHEN length(v)<55 AND trim(v) ~ '^[-−+]?([0-9]+|[0-9]{1,3}([   ][0-9]{3})+)([,.][0-9]+)?$'
        THEN translate(trim(v),',−   ','.-')::numeric END
$$;

CREATE FUNCTION accounting.project_inventory(r integration.dntrade_archive_records) RETURNS void LANGUAGE plpgsql AS $$
DECLARE raw jsonb := r.payload::jsonb->'raw'; rows_json jsonb := raw#>'{tables,0}'; headers text[]; layout text; kind text;
        store_key text; store_label text; family text := r.source_id; first_row integer; expected integer;
BEGIN
    IF jsonb_typeof(rows_json)='array' AND jsonb_typeof(rows_json#>'{0,cells}')='array' THEN
        SELECT array_agg(c->>'value' ORDER BY n) INTO headers FROM jsonb_array_elements(rows_json#>'{0,cells}') WITH ORDINALITY t(c,n);
    END IF;
    IF headers=ARRAY['Код','Назва','Од.вим.','Ціна','На початок','Прихід','Розхід','Залишок','Залишок в сумі'] THEN
        layout := 'valuation'; store_label := raw#>>'{scope,warehouses}';
        kind := CASE WHEN nullif(raw->>'cutoff','') IS NOT NULL AND raw#>>'{scope,groupProductVariants}'='false'
                   AND left(raw->>'cutoff',10)=r.source_day::text THEN 'cutover' ELSE 'reference' END;
    ELSIF headers=ARRAY['Код','Артикул','Назва','Залишок','Заброньовано','UUID товару'] THEN
        kind := 'balances'; layout := kind; store_key := lower(raw#>>'{warehouse,id}'); store_label := raw#>>'{warehouse,title}';
        family := coalesce(raw->>'capturedAtUtc',r.source_id)||'/'||coalesce(store_key,'');
        IF raw->>'firstRow' ~ '^[1-9][0-9]{0,7}$' THEN first_row := (raw->>'firstRow')::int; END IF;
        IF raw->>'reportRowCount' ~ '^[1-9][0-9]{0,7}$' THEN expected := (raw->>'reportRowCount')::int; END IF;
    ELSIF headers=ARRAY['Код','Назва','Одиниця','Штрихкод','Залишок','Закупівельна ціна','Роздрібна ціна','Статус'] THEN
        kind := 'inactive'; layout := kind; store_label := raw#>>'{scope,warehouses,0}';
    ELSE kind := 'unknown';
    END IF;
    INSERT INTO accounting.inventory_reports VALUES(r.id,r.source_account,r.source_id,r.source_day,kind,store_key,store_label,family,expected,first_row);
    IF layout IS NULL THEN RETURN; END IF;
    INSERT INTO accounting.inventory_lines(report_id,position,series_row,code,title,unit,quantity_text,quantity,booked,consistent)
    SELECT r.id,n,first_row+n-2,c#>>'{0,value}',CASE layout WHEN 'balances' THEN c#>>'{2,value}' ELSE c#>>'{1,value}' END,
        CASE WHEN layout<>'balances' THEN c#>>'{2,value}' END,qty,accounting.stock_number(qty),
        CASE WHEN layout='balances' THEN accounting.stock_number(c#>>'{4,value}') END,
        CASE WHEN layout='valuation' THEN accounting.stock_number(qty)=accounting.stock_number(c#>>'{4,value}')+
             accounting.stock_number(c#>>'{5,value}')-accounting.stock_number(c#>>'{6,value}')
        ELSE false END
    FROM jsonb_array_elements(rows_json) WITH ORDINALITY t(j,n)
    CROSS JOIN LATERAL (SELECT j->'cells' AS c) cells
    CROSS JOIN LATERAL (SELECT (c->(CASE layout WHEN 'valuation' THEN 7 WHEN 'balances' THEN 3 ELSE 4 END))->>'value' AS qty) q
    WHERE j->>'section'='TBODY';
    IF layout='balances' THEN
        -- The API export and the human-readable table must refer to the same product, store and quantities.
        UPDATE accounting.inventory_lines l SET consistent =
            (raw->>'rowCount')=(jsonb_array_length(rows_json)-1)::text AND
            (raw#>>ARRAY['sourceRows',(l.position-2)::text,'code'])=l.code AND
            lower(raw#>>ARRAY['sourceRows',(l.position-2)::text,'product_id'])=lower(rows_json#>>ARRAY[(l.position-1)::text,'cells','5','value']) AND
            lower(raw#>>ARRAY['sourceRows',(l.position-2)::text,'stores','0','store_id'])=store_key AND
            jsonb_typeof(raw#>ARRAY['sourceRows',(l.position-2)::text,'stores'])='array' AND
            (raw#>ARRAY['sourceRows',(l.position-2)::text,'stores','1']) IS NULL AND
            accounting.stock_number(raw#>>ARRAY['sourceRows',(l.position-2)::text,'stores','0','balance'])=l.quantity AND
            accounting.stock_number(raw#>>ARRAY['sourceRows',(l.position-2)::text,'stores','0','booked'])=l.booked
        WHERE l.report_id=r.id;
    END IF;
END $$;
CREATE FUNCTION accounting.receive_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM accounting.project_inventory(NEW); RETURN NEW; END $$;
LOCK TABLE integration.dntrade_archive_records IN SHARE ROW EXCLUSIVE MODE;
CREATE TRIGGER inventory_snapshot_insert AFTER INSERT ON integration.dntrade_archive_records
    FOR EACH ROW WHEN (NEW.entity_type='inventorySnapshot') EXECUTE FUNCTION accounting.receive_inventory();
SELECT accounting.project_inventory(a) FROM integration.dntrade_archive_records a WHERE entity_type='inventorySnapshot';

CREATE FUNCTION accounting.inventory_review(report uuid, org uuid)
RETURNS TABLE("position" integer,code text,title text,unit text,quantity_text text,quantity numeric,booked numeric,
    product_id uuid,product_name text,store_id uuid,status text,opening_id uuid,opening_org_id uuid) LANGUAGE sql STABLE AS $$
    WITH parts AS MATERIALIZED (
        SELECT b.* FROM accounting.inventory_reports a JOIN accounting.inventory_reports b
        ON a.source_account=b.source_account AND a.series=b.series WHERE a.id=report
    ), series_lines AS MATERIALIZED (
        SELECT l.*,p.declared_count FROM accounting.inventory_lines l JOIN parts p ON p.id=l.report_id
    ), codes AS (
        SELECT code,count(*) AS copies FROM series_lines GROUP BY code
    ), complete AS (
        SELECT count(*)=count(DISTINCT series_row) AND min(series_row)=1 AND max(series_row)=count(*)
          AND count(declared_count)=count(*) AND min(declared_count)=count(*) AND max(declared_count)=count(*) AS ok FROM series_lines
    ), stores AS (
        SELECT (array_agg(s.id))[1] AS id FROM parts p JOIN accounting.references s ON s.kind='store'
          AND s.source_account=p.source_account AND CASE WHEN p.store_ref IS NOT NULL THEN lower(s.source_id)=p.store_ref
            ELSE s.title=p.store_name END WHERE p.id=report HAVING count(*)=1
    )
    SELECT l.position,l.code,l.title,l.unit,l.quantity_text,l.quantity,l.booked,p.id,p.name,s.id,
        CASE WHEN conf.opening_id IS NOT NULL THEN 'confirmed'
          WHEN r.kind NOT IN ('cutover','balances') THEN 'reference'
          WHEN r.kind='balances' AND NOT coalesce(k.ok,false) THEN 'incomplete'
          WHEN r.day IS NULL OR s.id IS NULL THEN 'store'
          WHEN codes.copies<>1 THEN 'duplicate'
          WHEN p.id IS NULL THEN 'unmatched'
          WHEN l.quantity IS NULL OR l.quantity<0 OR l.quantity>1000000000 OR l.quantity<>round(l.quantity,3) THEN 'quantity'
          WHEN NOT coalesce(l.consistent,false) THEN 'difference'
          WHEN r.kind='balances' AND l.booked IS DISTINCT FROM 0 THEN 'reserved'
          WHEN other.opening_id IS NOT NULL OR w.product_id IS NOT NULL THEN 'existing'
          ELSE 'ready' END,lconf.id,lconf.org_id
    FROM series_lines l JOIN parts r ON r.id=l.report_id CROSS JOIN complete k
    LEFT JOIN codes ON codes.code=l.code LEFT JOIN stores s ON true
    LEFT JOIN catalog.products p ON r.source_account='valko-dntrade' AND p.navkolo_id='dntrade-code:'||l.code
    LEFT JOIN accounting.inventory_confirmations conf ON conf.report_id=l.report_id AND conf.position=l.position
    LEFT JOIN accounting.stock_openings lconf ON lconf.id=conf.opening_id
    LEFT JOIN accounting.inventory_confirmations other ON other.source_account=r.source_account AND other.store_id=s.id AND other.product_id=p.id
    LEFT JOIN accounting.warehouse_stock w ON w.org_id=org AND w.store_id=s.id AND w.product_id=p.id
    WHERE l.report_id=report
$$;
