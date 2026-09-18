/** Ciclo de vida de sesión en esta pestaña.
 *  established = alguna llamada autenticada ya funcionó.
 *  El overlay SESSION_EXPIRED solo debe mostrarse si established === true. */
let established = false;

export function markSessionEstablished() {
  established = true;
}

export function markSessionCleared() {
  established = false;
}

export function hasEstablishedSession() {
  return established;
}