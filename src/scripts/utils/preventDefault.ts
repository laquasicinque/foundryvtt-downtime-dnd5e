export function preventDefault<Ev extends Event>(fn: (event: Ev) => void) {
  return function (this: unknown, event: Ev) {
    event.preventDefault();
    fn.call(this, event);
  };
}
