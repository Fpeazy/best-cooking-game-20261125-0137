// SATE BAKAR — keyboard + mouse input, shared by the game loop and the shot stager.
// WASD / arrows move, E interacts with the nearest station, Space stokes the grill.
// Clicking a station walks the chef there and uses it; clicking an ingredient,
// sauce or garnish chip picks that item directly.
export function makeInput() {
  return {
    keys: { left: false, right: false, up: false, down: false },
    clicks: [], // every click, in order (a slow frame must never drop one)
    interactPressed: false,
    stokePressed: false,
    chopHeld: false,
    sauceHeld: false,
  };
}

export function attachInput(input, canvas) {
  const down = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.keys.down = true;
    if (e.key === 'e' || e.key === 'E') input.interactPressed = true;
    if (e.key === ' ') { input.stokePressed = true; e.preventDefault(); }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  };
  const up = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') input.keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') input.keys.down = false;
  };
  const onClick = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    input.clicks.push({ x, y });
  };
  const onDown = (e) => { input.chopHeld = true; input.sauceHeld = true; };
  const onUp = () => { input.chopHeld = false; input.sauceHeld = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
  };
}
