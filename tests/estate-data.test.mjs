import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
function load(file){const url=new URL('../lib/'+file,import.meta.url);const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(url,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:createRequire(url)});return exports;}
const {seed,supplyFor}=load('estate.ts');
const {optionalCount}=load('data-utils.ts');
test('empty upstream counts never become zero',()=>{for(const v of [undefined,null,'', '  ',true,-1,'abc'])assert.equal(optionalCount(v),null);assert.equal(optionalCount('0'),0);assert.equal(optionalCount('1,234'),1234);});
test('period totals are partial and completions are separate from occupancy',()=>{const s=supplyFor(seed,'울산광역시','전체',2026,'분양');assert.equal(s.value,775);assert.equal(s.partial,true);assert.equal(supplyFor(seed,'울산광역시','전체',2026,'준공').value,1557);assert.equal(supplyFor(seed,'울산광역시','전체',2026,'입주').value,null);assert.equal(supplyFor(seed,'울산광역시','전체',2025,'준공').value,4047);});
test('province statistics do not leak into district metrics',()=>{assert.equal(seed.find(x=>x.metric==='미분양'&&x.region==='울산광역시'&&x.district==='전체').units,1192);assert.equal(seed.filter(x=>x.metric==='미분양'&&x.region==='울산광역시'&&x.district==='남구').length,0);});
test('full year total supersedes partial records',()=>{const base=seed.find(x=>x.kind==='공급량'&&x.year===2026&&x.supplyType==='분양');const all=[base,{...base,id:'whole',units:2000,coverage:'전체집계',date:'2026-12-31'}];assert.equal(supplyFor(all,'울산광역시','전체',2026,'분양').value,2000);});
