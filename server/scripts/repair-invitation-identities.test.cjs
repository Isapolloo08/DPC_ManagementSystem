const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planPairs}=require('./repair-invitation-identities.cjs');
const a={id:2,first_name:'Member',last_name:'Fixture',birthdate:'2000-01-01',created_at:'2020-01-01',sync_identity:'local'};
test('exact clone repairs use cloud identity and preserve cloud-only members',()=>{
  const result=planPairs([a],[{...a,sync_identity:'cloud'},{...a,id:3,sync_identity:'extra'}],'members');
  assert.equal(result.length,1);assert.equal(result[0].identity,'cloud');assert.equal(result[0].previous,'local');
});
test('matching names are insufficient; changed shared fields and reused identities block repair',()=>{
  assert.throws(()=>planPairs([a],[{...a,created_at:'2021-01-01',sync_identity:'cloud'}],'members'),/Ambiguous/);
  assert.throws(()=>planPairs([a,{...a,id:3,sync_identity:'cloud'}],[{...a,sync_identity:'cloud'}],'members'),/already assigned/);
  assert.deepEqual(planPairs([a],[{...a,id:5}],'members'),[]);
});
test('event creators with remapped numeric IDs require the same account',()=>{
  const event={id:1,title:'Event',created_by:2,sync_identity:'local'};
  const remote={...event,created_by:9,sync_identity:'cloud'};
  assert.throws(()=>planPairs([event],[remote],'events',[{id:2,username:'a'}],[{id:9,username:'b'}]),/creator provenance/);
  assert.equal(planPairs([event],[remote],'events',[{id:2,username:'same'}],[{id:9,username:'same'}]).length,1);
});
