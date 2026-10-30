// iPad 카메라 테스트용 자체 서명 HTTPS 인증서를 certs/ 에 생성한다 (openssl 필요).
// 이 PC 의 사설 IP 를 인증서 주체 대체 이름(SAN)에 포함한다.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const ips = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4').map((a) => a.address);
const san = ['DNS:localhost', ...ips.map((ip) => 'IP:' + ip)].join(',');
mkdirSync('certs', { recursive: true });
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365',
  '-keyout', 'certs/key.pem', '-out', 'certs/cert.pem', '-subj', '/CN=took-local', '-addext', 'subjectAltName=' + san], { stdio: 'inherit' });
console.log('인증서 생성 완료: certs/ (' + san + ')');
