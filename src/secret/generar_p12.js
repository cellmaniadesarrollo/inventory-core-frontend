// npm i node-forge   (en la carpeta donde corras el script)
const forge = require('node-forge');
const fs = require('fs');

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [{ name: 'commonName', value: 'PRUEBA FIRMA' }];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey, forge.md.sha256.create());

const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'admin123', {
  algorithm: '3des', // compatible con forge al leerlo
});
const der = forge.asn1.toDer(p12Asn1).getBytes();
fs.writeFileSync('firma_prueba.p12', Buffer.from(der, 'binary'));
console.log('firma_prueba.p12 generado. Clave: admin123, titular: PRUEBA FIRMA');