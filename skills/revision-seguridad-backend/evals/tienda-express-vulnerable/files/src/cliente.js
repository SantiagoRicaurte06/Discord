export function guardarSesion(jwt) {
  localStorage.setItem('token', jwt);
}
