const fs = require('fs');
const path = require('path');

// Asegurar que el directorio de environments exista
const envDir = './src/environments';
if (!fs.existsSync(envDir)) {
    fs.mkdirSync(envDir, { recursive: true });
    console.log(`Directorio creado: ${envDir}`);
}

// Valor por defecto si no viene ninguna variable de entorno
const apiUrl = process.env.API_URL || 'https://ms.teamcellmania.com';

// 1. Configuración para Producción (environment.prod.ts)
const targetProdPath = path.join(envDir, 'environment.prod.ts');
const envProdConfigFile = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}'
};
`;

fs.writeFile(targetProdPath, envProdConfigFile, function (err) {
    if (err) {
        console.error("Error al generar environment.prod.ts:", err);
    } else {
        console.log(`[OK] Generado/Actualizado: ${targetProdPath} con apiUrl: ${apiUrl}`);
    }
});

// 2. Configuración Normal / Desarrollo (environment.ts)
const targetDevPath = path.join(envDir, 'environment.ts');
const envDevConfigFile = `export const environment = {
  production: false,
  apiUrl: '${apiUrl}'
};
`;

// Si no existe environment.ts, lo creamos
if (!fs.existsSync(targetDevPath)) {
    fs.writeFile(targetDevPath, envDevConfigFile, function (err) {
        if (err) {
            console.error("Error al generar environment.ts:", err);
        } else {
            console.log(`[OK] Creado por primera vez: ${targetDevPath}`);
        }
    });
} else {
    console.log(`[INFO] El archivo ${targetDevPath} ya existe, se omite su sobrescritura local.`);
}