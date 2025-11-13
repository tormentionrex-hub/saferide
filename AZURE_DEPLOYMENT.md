# Guía de Configuración para Deployment en Azure

## Problema Resuelto

El proyecto no se desplegaba correctamente en Azure debido a:
1. ❌ Faltaba el job de deploy en el workflow de GitHub Actions
2. ❌ No existía archivo `web.config` para Azure App Service
3. ❌ La configuración de empaquetado no era óptima

## Cambios Realizados

### 1. Archivo `web.config`
Se creó un archivo `web.config` que permite a IIS (servidor de Azure App Service) ejecutar correctamente la aplicación Node.js:
- Configura iisnode para manejar las peticiones
- Define las reglas de reescritura de URLs
- Habilita logging para debugging

### 2. Workflow de GitHub Actions
Se actualizó `.github/workflows/main_app-safe-ride-prd-001.yml`:
- ✅ Agregado job de deploy completo
- ✅ Empaquetado optimizado con zip
- ✅ Autenticación mediante publish profile
- ✅ Despliegue automático a Azure

### 3. Archivo `.zipignore`
Se optimizó para:
- ✅ Incluir `node_modules` (necesario en producción)
- ✅ Excluir archivos de desarrollo, tests, y configuración

## Configuración Requerida

### En GitHub (Secrets del Repositorio)

Debes verificar que existe el siguiente secret en tu repositorio de GitHub:

1. Ve a: `Settings` → `Secrets and variables` → `Actions`
2. Verifica o agrega el secret:
   - **Nombre**: `AZUREAPPSERVICE_PUBLISHPROFILE_APP_SAFE_RIDE_PRD_001`
   - **Valor**: El contenido del publish profile de tu Azure Web App

#### ¿Cómo obtener el Publish Profile?

**Opción 1: Desde Azure Portal**
```bash
1. Ve a Azure Portal (https://portal.azure.com)
2. Navega a tu App Service: app-safe-ride-prd-001
3. En el menú lateral, haz click en "Get publish profile"
4. Se descargará un archivo .publishsettings
5. Abre el archivo con un editor de texto
6. Copia TODO el contenido XML
7. Pégalo en el secret de GitHub
```

**Opción 2: Desde Azure CLI**
```bash
az webapp deployment list-publishing-profiles \
  --name app-safe-ride-prd-001 \
  --resource-group <tu-resource-group> \
  --xml
```

### Variables de Entorno en Azure App Service

Asegúrate de que las siguientes variables de entorno estén configuradas en tu Azure Web App:

1. Ve a Azure Portal → Tu App Service → `Configuration` → `Application settings`
2. Agrega/Verifica las siguientes variables:

```bash
NODE_ENV=production
PORT=8080                          # Azure lo configura automáticamente, pero es bueno verificar
API_VERSION=v1

# Base de Datos
COSMOS_CONNECTION_STRING=<tu-connection-string>
COSMOS_DATABASE=Safe-RideDB

# JWT
JWT_SECRET=<tu-jwt-secret>
JWT_EXPIRE=15m
REFRESH_TOKEN_SECRET=<tu-refresh-token-secret>
REFRESH_TOKEN_EXPIRE=7d

# Azure Blob Storage
BLOB_STORAGE_CONNECTION_STRING=<tu-blob-connection-string>
BLOB_CONTAINER_PROFILE=<nombre-contenedor-perfiles>
BLOB_CONTAINER_VEHICLE=<nombre-contenedor-vehiculos>

# Azure Entra ID (opcional)
ENTRA_TENANT_ID=<tu-tenant-id>
ENTRA_CLIENT_ID=<tu-client-id>
ENTRA_CLIENT_SECRET=<tu-client-secret>
ENTRA_REDIRECT_URI=<tu-redirect-uri>

# Application Insights (opcional pero recomendado)
APPLICATIONINSIGHTS_CONNECTION_STRING=<tu-app-insights-connection>

# CORS
CORS_ORIGIN=<tu-frontend-url>      # Ejemplo: https://tuapp.azurewebsites.net

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000        # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100

# Key Vault (opcional)
KEY_VAULT_URL=<tu-keyvault-url>
```

### Configuración de Node.js en Azure

Verifica la versión de Node.js en tu App Service:

```bash
# Desde Azure CLI
az webapp config set \
  --name app-safe-ride-prd-001 \
  --resource-group <tu-resource-group> \
  --linux-fx-version "NODE|22-lts"
```

O desde el Portal:
1. Ve a `Configuration` → `General settings`
2. En "Stack settings" selecciona:
   - Stack: Node
   - Major version: 22
   - Minor version: LTS

### Startup Command (Opcional)

Si es necesario, configura el startup command en Azure:

1. Ve a `Configuration` → `General settings`
2. En "Startup Command" ingresa: `node server.js`
3. Guarda los cambios

## Verificación del Deployment

### 1. Verifica que el workflow se ejecute

Después de hacer push a la rama `main`:
1. Ve a GitHub → `Actions`
2. Verifica que el workflow se ejecute correctamente
3. Deberías ver dos jobs: `build` y `deploy`

### 2. Verifica la aplicación en Azure

Una vez desplegado, prueba tu API:

```bash
# Health Check
curl https://app-safe-ride-prd-001.azurewebsites.net/api/v1/health

# Respuesta esperada:
{
  "success": true,
  "message": "Safe-Ride API is running",
  "timestamp": "2025-11-13T00:00:00.000Z",
  "environment": "production"
}
```

### 3. Revisa los logs en Azure

Si hay problemas:

```bash
# Desde Azure CLI
az webapp log tail \
  --name app-safe-ride-prd-001 \
  --resource-group <tu-resource-group>
```

O desde el Portal:
1. Ve a tu App Service
2. En el menú lateral: `Monitoring` → `Log stream`

## Solución de Problemas Comunes

### Error: "Resource Not Found" (404)

**Causa**: Puede ser que `web.config` no esté funcionando correctamente o que la aplicación no se haya iniciado.

**Solución**:
1. Verifica que `web.config` esté en la raíz del deployment
2. Revisa los logs de la aplicación
3. Verifica que todas las variables de entorno estén configuradas

### Error: "Application Error"

**Causa**: Error en la conexión a la base de datos o variables de entorno faltantes.

**Solución**:
1. Verifica que `COSMOS_CONNECTION_STRING` esté configurado correctamente
2. Verifica que el firewall de Cosmos DB permita conexiones desde Azure
3. Revisa los logs de la aplicación para ver el error específico

### Error: "502 Bad Gateway"

**Causa**: La aplicación no pudo iniciarse.

**Solución**:
1. Verifica que `npm install` se ejecutó correctamente
2. Verifica que todas las dependencias estén en `package.json`
3. Revisa los logs para ver errores de inicio

### La aplicación se despliega pero no funciona

**Solución**:
1. Habilita logging detallado en `web.config` (ya está habilitado)
2. Revisa los logs en `D:\home\LogFiles\Application` (accesible via Kudu)
3. Accede a Kudu: `https://app-safe-ride-prd-001.scm.azurewebsites.net`
4. Ve a `Debug console` → `CMD`
5. Navega a `LogFiles\Application`

## Siguientes Pasos

1. ✅ Configura el secret del publish profile en GitHub
2. ✅ Verifica todas las variables de entorno en Azure
3. ✅ Haz push a la rama `main` para disparar el deployment
4. ✅ Monitorea el workflow en GitHub Actions
5. ✅ Verifica que la API responda correctamente
6. ✅ Configura Application Insights para monitoreo (recomendado)

## Recursos Adicionales

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Deploy Node.js to Azure](https://docs.microsoft.com/en-us/azure/app-service/quickstart-nodejs)
- [GitHub Actions for Azure](https://docs.microsoft.com/en-us/azure/developer/github/github-actions)
- [IISNode Configuration](https://github.com/tjanczuk/iisnode/blob/master/src/samples/configuration/web.config)

## Soporte

Si tienes problemas adicionales después de seguir esta guía:
1. Revisa los logs de la aplicación en Azure
2. Verifica que todos los secrets estén configurados correctamente
3. Asegúrate de que el firewall de Cosmos DB permita conexiones desde Azure
4. Verifica que el publish profile sea válido

---

**Última actualización**: 2025-11-13
