const cheerio = require('cheerio');
const express = require('express');
const app = express();
const fs = require('fs');
const fetch = require('node-fetch');

app.set('port', 2998);


app.get('/', (req,res)=>{
  res.end("server running");
});

app.get('/scrape/:page', async (req, res)=>{
  let phoneData = await scrapePage(req.params.page);
  console.log(phoneData);
  res.json(phoneData);
});


let phoneData = {}, startTime, endTime;
app.get('/scrapeall', async (req, res)=>{
  startTime = new Date();
  res.end('Working... Check results using /peek-results');
  for (let i = 0; i < 77; i++){
    let fonez = await scrapePage(i);
    phoneData = Object.assign(phoneData, fonez);
    endTime = new Date();
  }

});

app.get('/peek-results', (req,res)=>{
  console.log("Timing:", startTime, endTime, (startTime.getTime()-endTime.getTime())/60000, 'mins');
  res.json(phoneData);
});


const url = 'https://api.data.gov/ed/collegescorecard/v1/schools.json?api_key=iDuKq0J3timfZjwHM8x2GF85NCjwKZp90D191cPO&_fields=id,school.name,school.school_url&_per_page=100';
function scrapePage(p){
  let numCompleted = 0;
  let colleges = {};
  return new Promise((resolve, reject)=>{
    console.log('######################FETCH '+p);
    fetch(url+'&_page='+p)
    .then(res=>res.json())
    .then(collegeJson=>{
      for (let i = 0; i < collegeJson.results.length; i++){
        let schoolName = collegeJson.results[i]['school.name'];
        let schoolUrl = collegeJson.results[i]['school.school_url'];
        if (!schoolUrl || schoolUrl == null || colleges[schoolUrl]){
          console.log("No new school page for", schoolName, "skipping...");
          numCompleted++;
          continue;
        }
        let fullSchoolUrl = schoolUrl;
        if (schoolUrl.indexOf ('http://') == -1)
          fullSchoolUrl = 'http://'+schoolUrl;
        //console.log("Fetching school page", schoolUrl);
        fetch(fullSchoolUrl)
        .then(res=>res.text())
        .then(res=>{
          //console.log('Receiving college page request '+numCompleted);
          numCompleted++;
          const $ = cheerio.load(res);
          let phones = Array.prototype.map.call($('a'), (e,i)=>$(e).attr('href')).filter(x=>{
            if (!x) return false;
            if (x.indexOf('tel')==0) return x.length > 13;
            return false;

          });

          if (phones && phones.length > 0){
            colleges[schoolUrl] = phones[0].substr(4);
            console.log('#########',schoolName, phones[0]);
          }
          else {
            //console.log("no tel href for", schoolName);
            $("*").each((i,e)=>{
              let content = e.innerHTML
              if (!content) return;
              if (content.length < 10 || content.length > 15) return;
              let phoneCandidate = content.replace(/[()\-+ A-z]/g, '');
              if (phoneCandidate.length < 9) return;
              if (phoneCandidate.length > 9 && phoneCandidate.length < 12) {
                colleges[schoolUrl] = phones[0].substr(4);
                console.log('#########',schoolName, phones[0]);
              }
            })
          }
          if (numCompleted >= 99) resolve(colleges);
        })
        .catch(err2=>{
          console.log('Receiving error for college page request '+numCompleted);
          colleges[schoolUrl] = err2.message;
          numCompleted++;
          if (numCompleted >= 99) resolve(colleges);
          //console.log(err2);
        });
      }
    })
    .catch(err=>{
      console.log(err);
      reject(err);
    })
  });
}

app.listen(app.get('port'), ()=>console.log('Server listening on port '+ app.get('port')));
