using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace PoliValko.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LaunchScope : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "delivery");

            migrationBuilder.EnsureSchema(
                name: "payments");

            migrationBuilder.EnsureSchema(
                name: "fiscal");

            migrationBuilder.AddColumn<string>(
                name: "navkolo_group_ref",
                schema: "catalog",
                table: "products",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "seo_description",
                schema: "catalog",
                table: "products",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "seo_title",
                schema: "catalog",
                table: "products",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                schema: "catalog",
                table: "products",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "variant_group",
                schema: "catalog",
                table: "products",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "variant_label",
                schema: "catalog",
                table: "products",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "delivery_address",
                schema: "ordering",
                table: "orders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "navkolo_exported_at",
                schema: "ordering",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "navkolo_order_ref",
                schema: "ordering",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pickup_address",
                schema: "ordering",
                table: "orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "refunded_amount",
                schema: "ordering",
                table: "orders",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "seller_name",
                schema: "ordering",
                table: "orders",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "seller_tax_id",
                schema: "ordering",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "filter_attributes",
                schema: "catalog",
                table: "categories",
                type: "text[]",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "seo_description",
                schema: "catalog",
                table: "categories",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "seo_title",
                schema: "catalog",
                table: "categories",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "integration",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    actor = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "contacts",
                schema: "content",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    store_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    services_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    schedule = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    map_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    instagram = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    facebook = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    telegram = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    you_tube = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_contacts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "home_collections",
                schema: "catalog",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_visible = table.Column<bool>(type: "boolean", nullable: false),
                    product_ids = table.Column<List<Guid>>(type: "uuid[]", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_home_collections", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "np_settlements",
                schema: "delivery",
                columns: table => new
                {
                    @ref = table.Column<string>(name: "ref", type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    area = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    search_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    active_warehouse_count = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_np_settlements", x => x.@ref);
                });

            migrationBuilder.CreateTable(
                name: "np_warehouses",
                schema: "delivery",
                columns: table => new
                {
                    @ref = table.Column<string>(name: "ref", type: "character varying(50)", maxLength: 50, nullable: false),
                    settlement_ref = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    number = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    search_text = table.Column<string>(type: "character varying(501)", maxLength: 501, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_np_warehouses", x => x.@ref);
                });

            migrationBuilder.CreateTable(
                name: "order_refunds",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    requested_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    provider_ref = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_refunds", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_refunds_orders_order_id",
                        column: x => x.order_id,
                        principalSchema: "ordering",
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pages",
                schema: "content",
                columns: table => new
                {
                    slug = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    lead = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    body_html = table.Column<string>(type: "text", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pages", x => x.slug);
                });

            migrationBuilder.CreateTable(
                name: "payment_events",
                schema: "payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    event_key = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    payment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    state = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payment_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                schema: "payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    provider = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    provider_payment_id = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    page_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    provider_modified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payments", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "pickup_points",
                schema: "delivery",
                columns: table => new
                {
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    schedule = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    instructions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    map_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pickup_points", x => x.code);
                });

            migrationBuilder.CreateTable(
                name: "product_attributes",
                schema: "catalog",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    value = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_attributes", x => x.id);
                    table.ForeignKey(
                        name: "fk_product_attributes_products_product_id",
                        column: x => x.product_id,
                        principalSchema: "catalog",
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "receipts",
                schema: "fiscal",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    kind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    refund_id = table.Column<Guid>(type: "uuid", nullable: true),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    payment_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    provider = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    provider_receipt_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    fiscal_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_receipts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "redirects",
                schema: "catalog",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    to_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    is_automatic = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_redirects", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sandbox_invoices",
                schema: "payments",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    order_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    refunded_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    redirect_url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    modified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sandbox_invoices", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "service_directions",
                schema: "content",
                columns: table => new
                {
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_visible = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_directions", x => x.code);
                });

            migrationBuilder.CreateTable(
                name: "sync_runs",
                schema: "integration",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    job = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    started_by = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    summary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    error_count = table.Column<int>(type: "integer", nullable: false),
                    errors = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sync_runs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sync_states",
                schema: "integration",
                columns: table => new
                {
                    job = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    last_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_success_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    consecutive_failures = table.Column<int>(type: "integer", nullable: false),
                    run_requested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    alerted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sync_states", x => x.job);
                });

            migrationBuilder.CreateTable(
                name: "order_refund_lines",
                schema: "ordering",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    refund_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_refund_lines", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_refund_lines_order_item_order_item_id",
                        column: x => x.order_item_id,
                        principalSchema: "ordering",
                        principalTable: "order_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_order_refund_lines_order_refunds_refund_id",
                        column: x => x.refund_id,
                        principalSchema: "ordering",
                        principalTable: "order_refunds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0001-7000-8000-000000000001"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Все для відпочинку", null, null });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0002-7000-8000-000000000002"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Все для поливу", null, null });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0003-7000-8000-000000000003"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Все для рослин", null, null });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0004-7000-8000-000000000004"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Господарчі товари", null, null });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0005-7000-8000-000000000005"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Ландшафтний дизайн", null, null });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0006-7000-8000-000000000006"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Новий рік", null, null });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0007-7000-8000-000000000007"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Ручний інструмент", null, null });

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0008-7000-8000-000000000008"),
                columns: new[] { "filter_attributes", "navkolo_ref", "seo_description", "seo_title" },
                values: new object[] { null, "Техніка для саду та городу", null, null });

            migrationBuilder.InsertData(
                schema: "content",
                table: "contacts",
                columns: new[] { "id", "address", "email", "facebook", "instagram", "map_url", "schedule", "services_phone", "store_phone", "telegram", "updated_at", "you_tube" },
                values: new object[] { 1, "м. Буча, Київська обл. (точну адресу надає магазин)", null, null, null, null, "Пн–Нд, 9:00–19:00 (уточнюється)", null, null, null, new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null });

            migrationBuilder.InsertData(
                schema: "content",
                table: "pages",
                columns: new[] { "slug", "body_html", "lead", "title", "updated_at", "updated_by" },
                values: new object[,]
                {
                    { "offer", "<p><strong>Чернетка структури.</strong> Остаточний текст надає й погоджує продавець перед запуском.</p><h2>1. Загальні положення</h2><p>Оформлюючи замовлення, покупець погоджується з умовами цієї оферти.</p><h2>2. Замовлення</h2><p>Замовлення оформлюється на сайті без реєстрації. Після оформлення покупець отримує номер замовлення.</p><h2>3. Ціна й оплата</h2><p>Ціни вказано в гривнях. Способи оплати: онлайн карткою, післяплата, оплата під час самовивозу.</p><h2>4. Доставка</h2><p>Новою поштою по Україні за тарифами перевізника або самовивіз у Бучі.</p><h2>5. Повернення</h2><p>Умови повернення описано на сторінці «Повернення й обмін».</p><h2>6. Продавець</h2><p>Реквізити продавця вказано нижче й на сторінці замовлення.</p>", "Договір купівлі-продажу між продавцем і покупцем інтернет-магазину.", "Публічна оферта", new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null },
                    { "payment-delivery", "<h2>Нова пошта</h2><p>Відділення, поштомат або кур'єр у будь-якому місті України. Місто й відділення обираєте під час оформлення.</p><p>Доставку оплачуєте за тарифами перевізника. Безкоштовну доставку не обіцяємо без затверджених умов.</p><h2>Самовивіз</h2><p>Магазин у Бучі. Коли замовлення готове, менеджер повідомляє, і ви забираєте його в робочі години.</p><h2>Оплата карткою</h2><p>Онлайн через платіжного провайдера. Статус оплати визначає лише підтвердження від провайдера.</p><h2>Післяплата</h2><p>Оплата у відділенні Нової пошти або кур'єру під час отримання.</p><h2>У магазині</h2><p>Оплата під час самовивозу в Бучі.</p>", "Нова пошта по Україні або самовивіз у Бучі.", "Доставка й оплата", new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null },
                    { "privacy", "<p><strong>Чернетка.</strong> Остаточну редакцію погоджує продавець.</p><h2>Які дані</h2><p>Ім'я, телефон, за бажанням email, населений пункт, відділення або адреса доставки, коментар до замовлення.</p><h2>Навіщо</h2><p>Щоб виконати й доставити замовлення, повідомити про його статус і прийняти оплату.</p><h2>Аналітика</h2><p>Ми рахуємо перегляди й покупки без передачі імені, телефону чи email в аналітичні системи.</p><h2>Зберігання</h2><p>Дані зберігаються на захищеному сервері; доступ мають лише працівники, які обробляють замовлення.</p><h2>Ваші права</h2><p>Ви можете попросити показати, виправити або видалити ваші дані, звернувшись за контактами магазину.</p>", "Які дані ми збираємо під час замовлення і як їх використовуємо.", "Політика приватності", new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null },
                    { "returns", "<p><strong>Чернетка.</strong> Умови погоджує продавець відповідно до закону «Про захист прав споживачів».</p><h2>Строк</h2><p>Товар належної якості можна повернути протягом 14 днів, якщо він не був у використанні й збережено товарний вигляд.</p><h2>Як повернути</h2><p>Зателефонуйте менеджеру й назвіть номер замовлення. Можна повернути все замовлення або окремі товари.</p><h2>Кошти</h2><p>Оплату карткою повертаємо на ту саму картку. Оплату під час отримання — у спосіб, погоджений з менеджером. На повернення видаємо чек.</p>", "Як повернути товар і отримати кошти.", "Повернення й обмін", new DateTimeOffset(new DateTime(2026, 10, 28, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), null }
                });

            migrationBuilder.InsertData(
                schema: "delivery",
                table: "pickup_points",
                columns: new[] { "code", "address", "instructions", "is_active", "map_url", "name", "schedule" },
                values: new object[] { "bucha-store", "м. Буча (точну адресу надає замовник)", "Дочекайтеся повідомлення, що замовлення готове, і назвіть номер замовлення на касі.", true, null, "Магазин Poli Valko у Бучі", "Пн–Нд, 9:00–19:00 (уточнюється)" });

            migrationBuilder.InsertData(
                schema: "content",
                table: "service_directions",
                columns: new[] { "code", "description", "is_visible", "sort_order" },
                values: new object[,]
                {
                    { "garden-care", "Сезонний догляд: обрізка, підживлення, мульчування, прибирання ділянки.", true, 5 },
                    { "greening", "Підбір і висадка дерев, кущів і багаторічників, що приживуться на вашій ділянці.", true, 3 },
                    { "irrigation-installation", "Розрахунок і монтаж автоматичного поливу газону, клумб і городу.", true, 2 },
                    { "irrigation-service", "Запуск навесні, консервація на зиму, ремонт і налаштування системи поливу.", true, 6 },
                    { "landscape-design", "Проєкт ділянки: зонування, доріжки, рослини й освітлення з урахуванням ґрунту та сонця.", true, 1 },
                    { "lawns", "Посівний або рулонний газон: підготовка основи, укладання, перший догляд.", true, 4 },
                    { "plant-treatment", "Захист від шкідників і хвороб препаратами, дозволеними в Україні.", true, 7 }
                });

            migrationBuilder.CreateIndex(
                name: "ix_products_variant_group",
                schema: "catalog",
                table: "products",
                column: "variant_group");

            migrationBuilder.CreateIndex(
                name: "ix_orders_navkolo_exported_at",
                schema: "ordering",
                table: "orders",
                column: "navkolo_exported_at");

            migrationBuilder.CreateIndex(
                name: "ix_categories_navkolo_ref",
                schema: "catalog",
                table: "categories",
                column: "navkolo_ref");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_at",
                schema: "integration",
                table: "audit_log",
                column: "at");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity_type_entity_id",
                schema: "integration",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "ix_home_collections_code",
                schema: "catalog",
                table: "home_collections",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_np_settlements_search_name",
                schema: "delivery",
                table: "np_settlements",
                column: "search_name")
                .Annotation("Npgsql:IndexOperators", new[] { "text_pattern_ops" });

            migrationBuilder.CreateIndex(
                name: "ix_np_warehouses_settlement_ref_is_active",
                schema: "delivery",
                table: "np_warehouses",
                columns: new[] { "settlement_ref", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_order_refund_lines_order_item_id",
                schema: "ordering",
                table: "order_refund_lines",
                column: "order_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_refund_lines_refund_id",
                schema: "ordering",
                table: "order_refund_lines",
                column: "refund_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_refunds_order_id",
                schema: "ordering",
                table: "order_refunds",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_events_payment_id",
                schema: "payments",
                table: "payment_events",
                column: "payment_id");

            migrationBuilder.CreateIndex(
                name: "ix_payment_events_provider_event_key",
                schema: "payments",
                table: "payment_events",
                columns: new[] { "provider", "event_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payments_order_id",
                schema: "payments",
                table: "payments",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_provider_provider_payment_id",
                schema: "payments",
                table: "payments",
                columns: new[] { "provider", "provider_payment_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payments_status_created_at",
                schema: "payments",
                table: "payments",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_product_attributes_name_value",
                schema: "catalog",
                table: "product_attributes",
                columns: new[] { "name", "value" });

            migrationBuilder.CreateIndex(
                name: "ix_product_attributes_product_id_sort_order",
                schema: "catalog",
                table: "product_attributes",
                columns: new[] { "product_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_receipts_order_id_kind_refund_id",
                schema: "fiscal",
                table: "receipts",
                columns: new[] { "order_id", "kind", "refund_id" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_redirects_from_path",
                schema: "catalog",
                table: "redirects",
                column: "from_path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sync_runs_job_started_at",
                schema: "integration",
                table: "sync_runs",
                columns: new[] { "job", "started_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "integration");

            migrationBuilder.DropTable(
                name: "contacts",
                schema: "content");

            migrationBuilder.DropTable(
                name: "home_collections",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "np_settlements",
                schema: "delivery");

            migrationBuilder.DropTable(
                name: "np_warehouses",
                schema: "delivery");

            migrationBuilder.DropTable(
                name: "order_refund_lines",
                schema: "ordering");

            migrationBuilder.DropTable(
                name: "pages",
                schema: "content");

            migrationBuilder.DropTable(
                name: "payment_events",
                schema: "payments");

            migrationBuilder.DropTable(
                name: "payments",
                schema: "payments");

            migrationBuilder.DropTable(
                name: "pickup_points",
                schema: "delivery");

            migrationBuilder.DropTable(
                name: "product_attributes",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "receipts",
                schema: "fiscal");

            migrationBuilder.DropTable(
                name: "redirects",
                schema: "catalog");

            migrationBuilder.DropTable(
                name: "sandbox_invoices",
                schema: "payments");

            migrationBuilder.DropTable(
                name: "service_directions",
                schema: "content");

            migrationBuilder.DropTable(
                name: "sync_runs",
                schema: "integration");

            migrationBuilder.DropTable(
                name: "sync_states",
                schema: "integration");

            migrationBuilder.DropTable(
                name: "order_refunds",
                schema: "ordering");

            migrationBuilder.DropIndex(
                name: "ix_products_variant_group",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropIndex(
                name: "ix_orders_navkolo_exported_at",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "ix_categories_navkolo_ref",
                schema: "catalog",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "navkolo_group_ref",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropColumn(
                name: "seo_description",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropColumn(
                name: "seo_title",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropColumn(
                name: "updated_at",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropColumn(
                name: "variant_group",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropColumn(
                name: "variant_label",
                schema: "catalog",
                table: "products");

            migrationBuilder.DropColumn(
                name: "delivery_address",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "navkolo_exported_at",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "navkolo_order_ref",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "pickup_address",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "refunded_amount",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "seller_name",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "seller_tax_id",
                schema: "ordering",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "filter_attributes",
                schema: "catalog",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "seo_description",
                schema: "catalog",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "seo_title",
                schema: "catalog",
                table: "categories");

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0001-7000-8000-000000000001"),
                column: "navkolo_ref",
                value: null);

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0002-7000-8000-000000000002"),
                column: "navkolo_ref",
                value: null);

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0003-7000-8000-000000000003"),
                column: "navkolo_ref",
                value: null);

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0004-7000-8000-000000000004"),
                column: "navkolo_ref",
                value: null);

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0005-7000-8000-000000000005"),
                column: "navkolo_ref",
                value: null);

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0006-7000-8000-000000000006"),
                column: "navkolo_ref",
                value: null);

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0007-7000-8000-000000000007"),
                column: "navkolo_ref",
                value: null);

            migrationBuilder.UpdateData(
                schema: "catalog",
                table: "categories",
                keyColumn: "id",
                keyValue: new Guid("0192f3a0-0008-7000-8000-000000000008"),
                column: "navkolo_ref",
                value: null);
        }
    }
}
