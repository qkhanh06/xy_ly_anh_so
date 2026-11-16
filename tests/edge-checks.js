async page => {
  const passed = [];
  const check = (ok, name) => { if(!ok)throw Error(name); passed.push(name); };
  await page.goto('http://localhost:8000');
  await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.locator('[data-mode="all"]').click();
  await page.keyboard.press('1');
  check(await page.locator('#feedback').isVisible(),'Numeric shortcut works after clicking a mode');
  await page.keyboard.press('Enter');
  check((await page.locator('#counter').textContent()).includes('2 / 10'),'Enter advances once after answering');
  await page.locator('#noteDetails summary').click();await page.locator('#noteInput').fill('');await page.locator('#noteInput').press('1');
  check(!await page.locator('#feedback').isVisible(),'Typing in notes never answers a question');
  await page.locator('#flashTab').click();
  await page.locator('#questionTitle').focus();await page.keyboard.press('Enter');
  check(await page.locator('#flashAnswer').isVisible(),'Enter reveals flashcard');
  await page.locator('[data-rating="again"]').click();
  const r=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('pixellab-study-v2'));const id=QUESTIONS.findIndex(q=>q[0]===document.getElementById('questionTitle').textContent);return s.records[id];});
  check(r.due-r.last===600000 && r.stage===0,'Forgotten flashcard resets interval to ten minutes');
  await page.evaluate(()=>{const s={version:2,records:{0:{last:Date.now(),due:0,stage:1,saved:true}},daily:{},goal:10,theme:'light'};localStorage.setItem('pixellab-study-v2',JSON.stringify(s));});
  await page.reload();await page.locator('#flashTab').click();await page.locator('[data-mode="saved"]').click();
  for(const days of [3,7,14,30,30]){await page.locator('#revealBtn').click();await page.locator('[data-rating="good"]').click();const diff=await page.evaluate(()=>{const r=JSON.parse(localStorage.getItem('pixellab-study-v2')).records[0];return r.due-r.last;});check(diff===days*86400000,`Success interval ${days} days`);await page.locator('#restartBtn').click();}
  await page.locator('#quizTab').click();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Active quiz fits ${width}px`);}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'mobile-preview.png',fullPage:true});
  await page.locator('#themeBtn').click();await page.setViewportSize({width:1440,height:1100});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'dark-preview.png',fullPage:true});
  await page.evaluate(()=>localStorage.setItem('pixellab-study-v2','{"records":null}'));await page.reload();check(await page.locator('.option').count()===4,'Malformed storage does not break study');
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('blocked','QuotaExceededError');};});await page.reload();await page.locator('.option').first().click();check(await page.locator('#feedback').isVisible(),'Study remains usable when storage is blocked');check(await page.locator('#toast').isVisible(),'Storage failure is visible to the learner');
  await page.evaluate(result=>window.__edgeResult=result,{passed:passed.length,checks:passed});
}
