// SATE BAKAR — the chef: a big, instantly findable cook who walks the floor lane,
// carries one skewer at a time, and auto-walks to a clicked station.
import { CHEF_START, FLOOR_Y, VIEW_W } from './config.js';

export const CHEF_SPEED = 420;

export function makeChef() {
  return {
    x: CHEF_START.x,
    y: CHEF_START.y,
    targetX: null,
    facing: 1,
    walkPhase: 0,
    moving: false,
    carrying: null, // { kind:'skewer'|'plate', ... } or null
    chopProgress: 0,
    sauceHold: 0,
  };
}

export function chefTick(chef, keys, dt) {
  let dx = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (chef.targetX !== null) {
    const diff = chef.targetX - chef.x;
    if (Math.abs(diff) < 6) {
      chef.targetX = null;
    } else {
      dx = Math.sign(diff);
    }
  }
  if (dx !== 0) {
    chef.facing = dx;
    chef.x = Math.min(VIEW_W - 60, Math.max(60, chef.x + dx * CHEF_SPEED * dt));
    chef.walkPhase += dt * 12;
    chef.moving = true;
  } else {
    chef.moving = false;
  }
  chef.y = FLOOR_Y + 40;
}

export function chefWalkTo(chef, x) {
  chef.targetX = Math.min(VIEW_W - 60, Math.max(60, x));
}

// Distance from the chef to a station centre (for the "near enough to use" rule).
export function chefNearStation(chef, station) {
  const cx = station.x + station.w / 2;
  return Math.abs(chef.x - cx) < station.w / 2 + 90;
}
