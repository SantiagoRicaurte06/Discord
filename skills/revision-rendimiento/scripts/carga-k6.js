// Plantilla de prueba de carga con k6 (https://k6.io). Solo contra local o staging, nunca producción.
// Uso:
//   k6 run -e URL=http://localhost:3000/api/productos scripts/carga-k6.js
//   k6 run -e URL=http://localhost:3000/api/productos -e PERFIL=pico scripts/carga-k6.js
// Perfiles: normal (por defecto), pico, estres, resistencia.
// Instalar k6: winget install k6 · brew install k6 · https://grafana.com/docs/k6/latest/set-up/install-k6/
import http from 'k6/http';
import { check, sleep } from 'k6';

const URL = __ENV.URL;
if (!URL || /^https?:\/\/(?!localhost|127\.0\.0\.1|staging)/i.test(URL) && !__ENV.CONFIRMO_NO_ES_PRODUCCION) {
  throw new Error('Define URL apuntando a local o staging. Si es otro host de pruebas, agrega -e CONFIRMO_NO_ES_PRODUCCION=1');
}

const PERFILES = {
  // Usuarios esperados durante unos minutos
  normal: [{ duration: '30s', target: 20 }, { duration: '2m', target: 20 }, { duration: '30s', target: 0 }],
  // Tráfico de golpe
  pico: [{ duration: '10s', target: 10 }, { duration: '10s', target: 300 }, { duration: '1m', target: 300 }, { duration: '20s', target: 0 }],
  // Subir hasta que falle
  estres: [{ duration: '1m', target: 50 }, { duration: '1m', target: 150 }, { duration: '1m', target: 300 }, { duration: '1m', target: 500 }, { duration: '1m', target: 0 }],
  // Varias horas a carga media (fugas de memoria, conexiones que no se cierran)
  resistencia: [{ duration: '2m', target: 30 }, { duration: '2h', target: 30 }, { duration: '2m', target: 0 }],
};

export const options = {
  stages: PERFILES[__ENV.PERFIL || 'normal'],
  thresholds: {
    // Mira p95 y p99, no el promedio
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(URL, { headers: { Accept: 'application/json' } });
  check(res, {
    'status 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  sleep(1); // un usuario real no hace peticiones sin parar
}
