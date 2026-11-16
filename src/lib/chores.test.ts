import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBathroom, bathroomGroups, bathroomName, choreIcon, choreSize, removeBathroom, setBathroomUsers, taskName } from './chores.ts';

test('bathrooms: add, names, users, remove', () => {
  const list = addBathroom([], 'Top floor', ['a', 'b']);
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 4);
  assert.equal(list[0].name, 'Top floor bathroom: Toilet');
  assert.equal(list[0].key, 'top floor bathroom toilet');
  assert.equal(choreSize(list[3]), 3);
  assert.deepEqual(list[0].users, ['a', 'b']);
  assert.equal(taskName(list[1]), 'Shower / bath');
  assert.equal(bathroomName("Charlie's en-suite"), "Charlie's en-suite");
  assert.deepEqual(bathroomGroups(list), ['Top floor bathroom']);
  assert.equal(typeof addBathroom(list, 'top floor', []), 'string');
  assert.deepEqual(setBathroomUsers(list, 'Top floor bathroom', ['c'])[2].users, ['c']);
  assert.equal(removeBathroom(list, 'Top floor bathroom').length, 0);
  assert.equal(choreIcon(list[0].key), 'water-outline');
});
