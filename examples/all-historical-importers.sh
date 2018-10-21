DEBUG=civix:* \
./bin/civix.js migrate && \
./bin/civix.js import civix-manual/divisions && \
./bin/civix.js import civix-manual/parties && \
./bin/civix.js import natural-earth/countries && \
./bin/civix.js import census-tiger/states && \
./bin/civix.js import census-tiger/counties --year=2018 && \
./bin/civix.js import census-tiger/counties --year=2017 && \
./bin/civix.js import census-tiger/congressional --congress=116 && \
./bin/civix.js import census-tiger/congressional --congress=115 && \
./bin/civix.js import census-tiger/congressional --congress=114 && \
./bin/civix.js import census-tiger/congressional --congress=113 && \
./bin/civix.js import census-tiger/congressional --congress=112 && \
./bin/civix.js import census-tiger/congressional --congress=111 && \
./bin/civix.js import census-tiger/congressional --congress=110 && \
./bin/civix.js import mn-boundaries/state-house --year=2012 && \
./bin/civix.js import mn-boundaries/state-house --year=2002 && \
./bin/civix.js import mn-boundaries/state-house --year=1994 && \
./bin/civix.js import mn-boundaries/state-senate --year=2012 && \
./bin/civix.js import mn-boundaries/state-senate --year=2002 && \
./bin/civix.js import mn-boundaries/state-senate --year=1994 && \
./bin/civix.js import mn-boundaries/county-commissioner --year=2018 && \
./bin/civix.js import mn-boundaries/county-commissioner --year=2016 && \
./bin/civix.js import mn-boundaries/county-commissioner --year=2014 && \
./bin/civix.js import mn-boundaries/county-commissioner --year=2012 && \
./bin/civix.js import mn-boundaries/municipal --year=2018 && \
./bin/civix.js import mn-boundaries/municipal --year=2016 && \
./bin/civix.js import mn-boundaries/municipal --year=2014 && \
./bin/civix.js import mn-boundaries/hospital --year=2018 && \
./bin/civix.js import mn-boundaries/hospital --year=2016 && \
./bin/civix.js import mn-boundaries/hospital --year=2014 && \
./bin/civix.js import mn-boundaries/hospital --year=2012 && \
./bin/civix.js import mn-boundaries/judicial --year=2018 && \
./bin/civix.js import mn-boundaries/judicial --year=2016 && \
./bin/civix.js import mn-boundaries/judicial --year=2014 && \
./bin/civix.js import mn-boundaries/judicial --year=2012 && \
./bin/civix.js import mn-boundaries/local-ward --year=2018 && \
./bin/civix.js import mn-boundaries/local-ward --year=2016 && \
./bin/civix.js import mn-boundaries/local-ward --year=2014 && \
./bin/civix.js import mn-boundaries/park-board --year=2018 && \
./bin/civix.js import mn-boundaries/park-board --year=2016 && \
./bin/civix.js import mn-boundaries/park-board --year=2014 && \
./bin/civix.js import mn-boundaries/park-district --year=2018 && \
./bin/civix.js import mn-boundaries/park-district --year=2016 && \
./bin/civix.js import mn-boundaries/park-district --year=2014 && \
./bin/civix.js import mn-boundaries/precinct --year=2018 && \
./bin/civix.js import mn-boundaries/precinct --year=2016 && \
./bin/civix.js import mn-boundaries/precinct --year=2014 && \
./bin/civix.js import mn-boundaries/precinct --year=2012 && \
./bin/civix.js import mn-boundaries/school --year=2017 && \
./bin/civix.js import mn-boundaries/soil-water --year=2018 && \
./bin/civix.js import mn-boundaries/soil-water --year=2016 && \
./bin/civix.js import mn-boundaries/soil-water --year=2014 && \
./bin/civix.js import mn-boundaries/soil-water --year=2012 && \
