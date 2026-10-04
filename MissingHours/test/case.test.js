import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deductions, evidence, assessDeduction } from '../src/case.js';
const collected=evidence.map(e=>e.id);
test('every case deduction can be established with its inspectable evidence',()=>{
  for(const d of deductions){
    assert.ok(d.requires.every(id=>collected.includes(id)));
    assert.equal(assessDeduction(d.id,d.answer,d.requires,collected).ok,true);
  }
});
test('a right guess cannot pass without the essential evidence',()=>{
  for(const d of deductions) for(const omitted of d.requires){
    assert.equal(assessDeduction(d.id,d.answer,d.requires.filter(id=>id!==omitted),collected).ok,false);
  }
});
test('uncollected evidence and indiscriminate citations cannot bypass investigation',()=>{
  for(const d of deductions){
    assert.equal(assessDeduction(d.id,d.answer,d.requires,[]).ok,false);
    assert.equal(assessDeduction(d.id,d.answer,collected,collected).ok,false);
  }
});
test('all alternatives fail even with the right evidence',()=>{
  for(const d of deductions)for(const answer of d.options.filter(a=>a!==d.answer)){
    assert.equal(assessDeduction(d.id,answer,d.requires,collected).ok,false);
  }
});
