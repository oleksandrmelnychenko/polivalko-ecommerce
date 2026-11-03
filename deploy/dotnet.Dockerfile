FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
ENV OpenApiGenerateDocuments=false \
    DOTNET_CLI_TELEMETRY_OPTOUT=1

COPY global.json Directory.Build.props Directory.Packages.props dotnet-tools.json PoliValko.slnx ./
COPY src/PoliValko.SharedKernel/PoliValko.SharedKernel.csproj src/PoliValko.SharedKernel/
COPY src/PoliValko.Infrastructure/PoliValko.Infrastructure.csproj src/PoliValko.Infrastructure/
COPY src/PoliValko.Api/PoliValko.Api.csproj src/PoliValko.Api/
COPY src/PoliValko.Worker/PoliValko.Worker.csproj src/PoliValko.Worker/
COPY src/Modules/PoliValko.Catalog/PoliValko.Catalog.csproj src/Modules/PoliValko.Catalog/
COPY src/Modules/PoliValko.Content/PoliValko.Content.csproj src/Modules/PoliValko.Content/
COPY src/Modules/PoliValko.Notifications/PoliValko.Notifications.csproj src/Modules/PoliValko.Notifications/
COPY src/Modules/PoliValko.Delivery/PoliValko.Delivery.csproj src/Modules/PoliValko.Delivery/
COPY src/Modules/PoliValko.Identity/PoliValko.Identity.csproj src/Modules/PoliValko.Identity/
COPY src/Modules/PoliValko.Ordering/PoliValko.Ordering.csproj src/Modules/PoliValko.Ordering/
COPY src/Modules/PoliValko.Payments/PoliValko.Payments.csproj src/Modules/PoliValko.Payments/
COPY src/Modules/PoliValko.Fiscal/PoliValko.Fiscal.csproj src/Modules/PoliValko.Fiscal/
COPY src/Modules/PoliValko.Navkolo/PoliValko.Navkolo.csproj src/Modules/PoliValko.Navkolo/
COPY src/Modules/PoliValko.Admin/PoliValko.Admin.csproj src/Modules/PoliValko.Admin/
RUN dotnet restore src/PoliValko.Api/PoliValko.Api.csproj \
 && dotnet restore src/PoliValko.Worker/PoliValko.Worker.csproj \
 && dotnet tool restore

COPY src/ src/
RUN dotnet publish src/PoliValko.Api -c Release --no-restore -o /out/api \
 && dotnet publish src/PoliValko.Worker -c Release --no-restore -o /out/worker \
 && dotnet tool run dotnet-ef migrations bundle \
      --project src/PoliValko.Infrastructure --startup-project src/PoliValko.Api \
      --configuration Release --self-contained -r linux-x64 -o /out/migrate/efbundle

FROM mcr.microsoft.com/dotnet/runtime-deps:10.0 AS migrate
WORKDIR /app
COPY --from=build /out/migrate/efbundle .
USER $APP_UID
ENTRYPOINT ["sh", "-c", "./efbundle --connection \"$ConnectionStrings__PoliValko\""]

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
COPY --from=build /out/api .
ENV ASPNETCORE_HTTP_PORTS=8080
RUN mkdir -p /data/media && chown "$APP_UID" /data/media
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "PoliValko.Api.dll"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS worker
WORKDIR /app
COPY --from=build /out/worker .
USER $APP_UID
ENTRYPOINT ["dotnet", "PoliValko.Worker.dll"]
