import assert from 'node:assert/strict';
import { ballOwnFactor, ballRimStyle } from '../src/ball-rim.js';

assert.equal(ballOwnFactor({}), 1);
assert.equal(ballOwnFactor({ scoreFactor: 1, valueFactor: 1 }), 1);
assert.equal(ballOwnFactor({ scoreFactor: 2, valueFactor: 1 }), 2, 'a star on a normal launch is ×2');
assert.equal(ballOwnFactor({ scoreFactor: 1, valueFactor: 2 }), 2, 'a ×2 launch with no star is ×2');
assert.equal(ballOwnFactor({ scoreFactor: 2, valueFactor: 4 }), 8, 'launch ×N and stars multiply');
assert.equal(ballOwnFactor({ scoreFactor: 5, valueFactor: 2 }), 10, 'a purple star stacks with the launch factor');
assert.equal(ballOwnFactor({ scoreFactor: 0, valueFactor: 8 }), 8);

for (const [factor, tier] of [[1, 1], [1.5, 2], [2, 2], [3, 2], [4, 4], [5, 4], [7, 4], [8, 8], [10, 8], [40, 8]]) {
  assert.equal(ballRimStyle(factor).tier, tier, `×${factor} uses the ×${tier} rim`);
}
assert.equal(ballRimStyle(1).glow, null, 'the default rim is a plain light-gold line');
assert.equal(ballRimStyle(2).glow, null, '×2 is a solid orange rim');
assert.ok(ballRimStyle(4).glow, '×4 grows a halo');
assert.ok(ballRimStyle(8).glow, '×8 grows an outward halo');
assert.ok(ballRimStyle(1).span < ballRimStyle(2).span);
assert.ok(ballRimStyle(1).width < ballRimStyle(2).width);
assert.notEqual(ballRimStyle(1).color, ballRimStyle(2).color);
assert.notEqual(ballRimStyle(2).color, ballRimStyle(8).color);
assert.notEqual(ballRimStyle(4).color, ballRimStyle(8).color);
const eight = ballRimStyle(8);
const forty = ballRimStyle(40);
assert.equal(forty.tier, 8);
assert.ok(forty.extra > eight.extra && forty.glowScale > eight.glowScale, 'past ×8 the same rim glows a little harder');
console.log('PASS: ball rims follow launch ×N times stars, and anything above ×8 stays on the ×8 rim.');
