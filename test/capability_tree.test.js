'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { CapabilityTree } = require('../src/tree/capability_tree');
const { createNode } = require('../src/tree/node');
const { saveCapabilityTree } = require('../src/gep/store');

describe('capability_tree', () => {
  let backupTree;

  beforeEach(() => {
    const store = require('../src/gep/store');
    backupTree = store.loadCapabilityTree();
    // 重置为空树
    saveCapabilityTree({
      root: { id: 'cap', name: 'Root', level: 'high', parent_id: null, children: [] },
      nodes: {},
    });
  });

  afterEach(() => {
    saveCapabilityTree(backupTree);
  });

  it('starts with empty tree', () => {
    const tree = new CapabilityTree();
    assert.strictEqual(tree.getAllNodes().length, 0);
  });

  it('addNode adds to tree', () => {
    const tree = new CapabilityTree();
    const node = createNode({
      id: 'cap.test',
      name: 'Test Capability',
      level: 'low',
      parent_id: 'cap',
    });
    tree.addNode(node);
    assert.strictEqual(tree.getAllNodes().length, 1);
    assert.strictEqual(tree.getNode('cap.test').name, 'Test Capability');
  });

  it('addNode rejects node without valid parent', () => {
    const tree = new CapabilityTree();
    const node = createNode({
      id: 'cap.orphan',
      name: 'Orphan',
      level: 'low',
      parent_id: 'nonexistent',
    });
    assert.throws(() => tree.addNode(node));
  });

  it('getChildren returns direct children', () => {
    const tree = new CapabilityTree();
    tree.addNode(createNode({ id: 'cap.a', name: 'A', level: 'mid', parent_id: 'cap' }));
    tree.addNode(createNode({ id: 'cap.b', name: 'B', level: 'mid', parent_id: 'cap' }));
    tree.addNode(createNode({ id: 'cap.a.x', name: 'AX', level: 'low', parent_id: 'cap.a' }));

    const rootChildren = tree.getChildren('cap');
    assert.strictEqual(rootChildren.length, 2);

    const aChildren = tree.getChildren('cap.a');
    assert.strictEqual(aChildren.length, 1);
    assert.strictEqual(aChildren[0].id, 'cap.a.x');
  });

  it('removeNode removes node and cleans parent', () => {
    const tree = new CapabilityTree();
    tree.addNode(createNode({ id: 'cap.rm', name: 'Remove Me', level: 'low', parent_id: 'cap' }));
    assert.strictEqual(tree.getAllNodes().length, 1);
    tree.removeNode('cap.rm');
    assert.strictEqual(tree.getAllNodes().length, 0);
  });

  it('getPath returns path from root', () => {
    const tree = new CapabilityTree();
    tree.addNode(createNode({ id: 'cap.l1', name: 'L1', level: 'high', parent_id: 'cap' }));
    tree.addNode(createNode({ id: 'cap.l1.l2', name: 'L2', level: 'mid', parent_id: 'cap.l1' }));

    const path = tree.getPath('cap.l1.l2');
    assert.ok(path.length >= 2);
  });

  it('growNode creates node under parent', () => {
    const tree = new CapabilityTree();
    tree.addNode(createNode({ id: 'cap.parent', name: 'Parent', level: 'high', parent_id: 'cap' }));
    tree.growNode('cap.parent', {
      id: 'cap.parent.child',
      name: 'Child',
      level: 'low',
    });
    assert.strictEqual(tree.getAllNodes().length, 2);
    assert.strictEqual(tree.getNode('cap.parent.child').name, 'Child');
  });

  it('getActiveNodes filters pruned', () => {
    const tree = new CapabilityTree();
    tree.addNode(createNode({ id: 'cap.active', name: 'Active', level: 'low', parent_id: 'cap' }));
    // Manually set one node's status
    const n = tree.getNode('cap.active');
    n.status = 'pruned';
    assert.strictEqual(tree.getActiveNodes().length, 0);
  });

  it('save and reload preserves data', () => {
    const tree = new CapabilityTree();
    tree.addNode(createNode({ id: 'cap.persist', name: 'Persist', level: 'low', parent_id: 'cap' }));
    tree.save();

    const tree2 = new CapabilityTree();
    assert.strictEqual(tree2.getAllNodes().length, 1);
    assert.strictEqual(tree2.getNode('cap.persist').name, 'Persist');
  });
});
