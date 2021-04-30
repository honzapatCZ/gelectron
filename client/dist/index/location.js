
const bulbx = 136049870;
const bulby = 1294427400;
const bulbz = 2923345368;
const bulbradius = 696000000;


function getLocalXYZ(rawSystemCoordsCopiedFromClipboard, date) {

    const start = date

    let systemX = 0;
    let systemY = 0;
    let systemZ = 0;

    [systemX,
        systemY,
        systemZ] = parseSystemCoords(rawSystemCoordsCopiedFromClipboard);

    const body = getNearbyBody(systemX, systemY);

    if (body.planet === '') {
        return {error: true};
    } else if (body.planet === 'deep space') {
        console.log(`not near a planet/moon`);
        return {body: false, coordinates: [systemX, systemY, systemZ]};
    } else {
        console.log(`planet/moon is ${body.planet}`);
    }

    const result = doEverything(body.planet, start, systemX, systemY, systemZ);

    if (result) {
        return {body: body.name, location: result.location, daytime: result.daytime};
    } else {
        return {body: body.name};
    }



}

function parseSystemCoords(raw) {
    let t = raw.replace("Coordinates: x:", "");
    let u = t.replace("y:", "");
    let v = u.replace("z:", "");
    let xyz = v.split(" ");
    return [Number(xyz[0]), Number(xyz[1]), Number(xyz[2])];
}



// THIS PART OF THE CODE MAKES THE MAIN CALCULATIONS FOR EVERYTHING. AT THE END IT EXECUTES THE DRAWING FUNCTIONS
// USING THE CALCULATED VALUES.

function doEverything(body, start, Plx, Ply, Plz) {

    let time1 = Date.now();
    let time2 = 0;

    let slide = 0;

    let bodyData = getBodyData(body);// Grabs data for each planet (radius, rotation speed, declination, coordinates, etc...)
    let planetRadius    = bodyData.planetRadius;
    let planetX         = bodyData.planetX;
    let planetY         = bodyData.planetY;
    let declination     = bodyData.declination;
    let greenwich_epoch = bodyData.greenwich_epoch;
    let refAngle        = bodyData.refAngle;
    let refR            = bodyData.refR;
    let elevhyp         = bodyData.elevhyp;
    let hfullrot        = bodyData.hfullrot;

    // CALCULATES "HOW BIG" IS THE SUN SEEN FROM EACH PLANET SURFACE//////////////////
    let disc = Math.atan(bulbradius / elevhyp);

    // ANGULAR VELOCITY FOR PLANETS, CONVERT FROM TIME IN HOURS TO SECONDS. SETUP FOR HOW LONG PROGRAM HAS BEEN RUNNING///////
    let angVel = 2 * Math.PI / (hfullrot * 3600000); // in radians per milisecond. (multiply *300 and input some coordinates if you want to see the sunrise graph accelerated for testing purposes or fun)
    let angVelDeg = 360 / (hfullrot * 3600000);      // in degrees per milisecond
    let mseconds = (Date.now() - start) - time2;     // miliseconds passed since last coordinates input.


    // MAKES BULB  COORDINATES CENTER OF REFERENCE, AND REFERENCES PLAYER TO PLANET CENTER.
    let currentX = Plx - planetX - bulbx;
    let currentY = Ply - planetY - bulby;
    let latx = currentX;
    let laty = currentY;
    let latz = Plz;


    // ANGULATION OF PLANET ACCORDING TO BULB, IN XY AXIS. In the x plane, angle where the planet is located according to bulb.
    let rot = bodyData.anglefacesun;
    let startangle = Math.atan2(currentY, currentX);
    if (startangle < 0) {
        startangle = startangle + (2 * Math.PI);
    }

    // The terminator line is a circle. Due to declination, when you project this circle on a plane it is seen as an ellipse.
    // according to player latitude, the circular motion has a radius equal to planet radius at equator but smaller on higher latitudes.
    // This code calculates the ellipse, and how it is oriented towards the sun.
    // it calculates then when the player (point moving on a circle), will intersect the terminator line (ellipse) according to latitude

    let t = ((mseconds * angVel) + startangle) % (2 * Math.PI);           // adjust for revolutions>1
    let a = planetRadius * Math.sin(declination) / Math.sin(Math.PI / 2); // calculates ellipse minor axis according
    let r = Math.sqrt((planetRadius * planetRadius) - (Plz * Plz));       // smaller radius at higher altitudes

    let rCorrected = Math.sqrt(currentX*currentX + currentY*currentY) //to get correct conversion to lat/long at altitude different from 0

    if (isNaN(r)) { r = 1; } /////////////////////////////////////////////// THIS IS THE FIX FOR THE NaN ISSUE
    let x1 = a * Math.cos(t) * Math.cos(rot) - planetRadius * Math.sin(t) * Math.sin(rot);
    let y1 = a * Math.cos(t) * Math.sin(rot) + planetRadius * Math.sin(t) * Math.cos(rot);
    let intx = Math.abs(a * Math.sqrt((r * r - planetRadius * planetRadius) / (a * a - planetRadius * planetRadius)));
    let inty = Math.abs(planetRadius * Math.sqrt((a * a - r * r) / (a * a - planetRadius * planetRadius)));


    //TERMINATOR POINTS coordinates on ellipse, day and night, FOR NORTH AND SOUTH HEMISPHERES

    let sunsouthx   =  intx * Math.cos(rot) - inty * Math.sin(rot)
    let sunsouthy   =  intx * Math.sin(rot) + inty * Math.cos(rot)
    let sunnorthx   = -intx * Math.cos(rot) - inty * Math.sin(rot)
    let sunnorthy   = -intx * Math.sin(rot) + inty * Math.cos(rot)
    let nightsouthx =  intx * Math.cos(rot) + inty * Math.sin(rot)
    let nightsouthy =  intx * Math.sin(rot) - inty * Math.cos(rot)
    let nightnorthx = -intx * Math.cos(rot) + inty * Math.sin(rot)
    let nightnorthy = -intx * Math.sin(rot) - inty * Math.cos(rot)
    let DN = createVector(sunnorthx, sunnorthy)
    let DS = createVector(sunsouthx, sunsouthy)
    let NN = createVector(nightnorthx, nightnorthy)
    let NS = createVector(nightsouthx, nightsouthy)
    if (t > Math.PI) {
        t = t - 2 * Math.PI
    }
    let PL = createVector(rCorrected * Math.cos(t), rCorrected * Math.sin(t))
    let angleNN = Math.atan2(NN.y, NN.x, 0, 0)
    let angleDN = Math.atan2(DN.y, DN.x, 0, 0)
    let angleNS = Math.atan2(NS.y, NS.x, 0, 0)
    let angleDS = Math.atan2(DS.y, DS.x, 0, 0)
    let anglePL = Math.atan2(PL.y, PL.x, 0, 0)
    let degNN = angleNN * 180 / Math.PI;
    let degDN = angleDN * 180 / Math.PI;
    let degNS = angleNS * 180 / Math.PI;
    let degDS = angleDS * 180 / Math.PI;
    let degPL = anglePL * 180 / Math.PI;

    if (degNN < 0) {
        degNN = degNN + 360;
    }
    if (degDN < 0) {
        degDN = degDN + 360;
    }
    if (degNS < 0) {
        degNS = degNS + 360;
    }
    if (degDS < 0) {
        degDS = degDS + 360;
    }
    if (degPL < 0) {
        degPL = degPL + 360;
    }

    let angleSunset;
    let angleSunrise;

    // change this code if (Plz > 0) to > to display inverted times to hemisphere, testing
    if (Plz < 0) {
        angleSunset = degNN - degPL;
        if (angleSunset < 0) {
            angleSunset = 360 + angleSunset;
        }
        angleSunrise = degDN - degPL;
        if (angleSunrise < 0) {
            angleSunrise = 360 + angleSunrise;
        }
    } else {
        angleSunset = degNS - degPL;
        if (angleSunset < 0) {
            angleSunset = 360 + angleSunset;
        }
        angleSunrise = degDS - degPL;
        if (angleSunrise < 0) {
            angleSunrise = 360 + angleSunrise;
        }
    }


    //ADJUSTS TIMES OF SUNSET FOR UPPER BORDER DISAPPEARING BELOW HORIZON, AND SUNRISE FOR UPPER BORDER SHOWING ABOVE HORIZON
    //INSTEAD OF SHOWING WHERE SUN MIDDLE POINT IS (PRIOR CALCULATION OF "HOW BIG SUN IS SEEN FROM EACH PLANET")
    //ADDS OR SUBSTRACT TIME ACCORDING TO ELEVATION OF HORIZON LINE.

    let horizonAngle   = -slide * 20 / 120;  // by manually setting horizon line elevation, it adds or substract time.
    let bordertime     = (disc / angVel)/1000; // this adds or substract time to see upper border of star appearing or dissapearing above horizon.Depending on how big is the sun seen from this planet.
    let timeTosunset   = (((angleSunset  - horizonAngle) / (angVel * 180 / Math.PI)) + bordertime)/1000;
    let timeTosunrise  = (((angleSunrise + horizonAngle) / (angVel * 180 / Math.PI)) - bordertime)/1000;
    let horizonSeconds = (horizonAngle/angVelDeg)/1000;


    //SET TIME FOR NORTH/SOUTH HEMISPHERE AND CONVERSION FROM SECS TO HOURS MIN AND SECS.

    let nightDuration = 0;
    let dayDuration = 0;

    let timetofullrot = (360 / angVelDeg)/1000;
    if (Plz >= 0) {
        if ((planetX > 0 && planetY < 0) || (planetX > 0 && planetY > 0)) {
            nightDuration = ((degNN - degDN) / angVelDeg)/1000;
            dayDuration = timetofullrot - nightDuration;
        }
        if ((planetX < 0 && planetY > 0) || (planetX < 0 && planetY < 0)) {
            nightDuration = ((degDN - degNN) / angVelDeg)/1000;
            dayDuration = timetofullrot - nightDuration;
        }
    }
    if (Plz < 0) {
        if ((planetX > 0 && planetY < 0) || (planetX > 0 && planetY > 0)) {
            nightDuration = ((degNS - degDS) / angVelDeg)/1000;
            dayDuration = timetofullrot - nightDuration;
        }
        if ((planetX < 0 && planetY > 0) || (planetX < 0 && planetY < 0)) {
            nightDuration = ((degDS - degNS) / angVelDeg)/1000;
            dayDuration = timetofullrot - nightDuration;
        }
    }


    let risehour    = parseInt(timeTosunrise / 3600);
    let risemindec  = ((timeTosunrise / 3600) - risehour) * 60;
    let risemin     = parseInt(risemindec);
    let risesec     = parseInt((risemindec - risemin) * 60);
    let sethour     = parseInt(timeTosunset / 3600);
    let setmindec   = ((timeTosunset / 3600) - sethour) * 60;
    let setmin      = parseInt(setmindec);
    let setsec      = parseInt((setmindec - setmin) * 60);
    let dayhour     = parseInt(dayDuration / 3600);
    let daymindec   = ((dayDuration / 3600) - dayhour) * 60;
    let daymin      = parseInt(daymindec);
    let daysec      = parseInt((daymindec - daymin) * 60);
    let nighthour   = parseInt(nightDuration / 3600);
    let nightmindec = ((nightDuration / 3600) - nighthour) * 60;
    let nightmin    = parseInt(nightmindec);
    let nightsec    = parseInt((nightmindec - nightmin) * 60);


    //Calculate Sun angle (to shift sine) and position in sky
    let sun = anglePL - rot + Math.PI / 2 + Math.PI//sun position = Math.sin(sunAngle)
        if (sun < 0) {sun += 2 * Math.PI}
        if (sun >= 2 * Math.PI) {sun -= 2 * Math.PI}
    const horizon = (dayDuration - horizonSeconds - bordertime) / timetofullrot * 2 - 1 //(dayDuration - horizonSeconds - bordertime) is between 0 ... timetofullrot, this value will be between -1 ... 1

    // THIS IS THE MAIN CODE TO CONVERT GLOBAL COORDS TO LOCAL COORDS.
    // it checks "where was OM3 at a specific time". Then calculates which global coords has OM3 NOW, by checking in real time how many miliseconds has passed since then.

    let now_epoch = Date.now()
    let ref_epoch = now_epoch - greenwich_epoch;//(time now minus time from a reference value)
    let greenwichNow = ((angVelDeg * ref_epoch) + refAngle) % 360;//which angle is OM3 now.


    let r1 = Math.sqrt(PL.x * PL.x + PL.y * PL.y);
    let direction;
    if (greenwichNow > 180) {
        greenwichNow = greenwichNow - 360;
    }
    let greenwichNowrad = greenwichNow * Math.PI / 180;
    let greenwichcurrentx = refR * Math.cos(greenwichNowrad);
    let greenwichcurrenty = refR * Math.sin(greenwichNowrad);
    let green = createVector(greenwichcurrentx, greenwichcurrenty);
    let longitude = (angleBetween(green, PL)) * 180 / Math.PI; //respect to planet center, which angle is player and which angle is OM3, then you have longitude.
    if (longitude < 0) {
        direction = "W";
    } //twisted due to p5.js canvas orientation (x is right positive, y is down positive, z is positive towards user)
    else {
        direction = "E";
    }
    let latitude = Math.atan(latz / rCorrected) * 180 / Math.PI;
    let plheight = parseInt((dist(0, 0, 0, latx, laty, latz)) - planetRadius);

    //This convert degrees to deg, min sec.
    let latdeg     = parseInt(latitude);
    let latmindec  = (latitude - latdeg) * 60;
    let latmin     = parseInt(latmindec);
    let latsec     = parseInt((latmindec - latmin) * 60);
    let longdeg    = parseInt(Math.abs(longitude));
    let longmindec = (Math.abs(longitude) - longdeg) * 60;
    let longmin    = parseInt(longmindec);
    let longsec    = parseInt((longmindec - longmin) * 60);
    if (latz >= 0) {
        hem = "N";
    } else {
        hem = "S";
    }


    console.log("lat:  " + hem  + "  " + latdeg + "º" + "  " + latmin + "'  " + latsec + "''");
    console.log("long: " + direction + "  " + longdeg + "º" + "  " + longmin + "'  " + longsec + "''");
    console.log("height: " + plheight + "  meters");
    console.log("local X: " + Math.round(rCorrected * Math.sin(angleBetween(invert(green), PL)) / 1000, 2));
    console.log("local Y: " + Math.round(rCorrected * Math.cos(angleBetween(green, PL)) / 1000, 2));
    console.log("local Z: " + Plz / 1000);
    console.log('\n');


    if (timeTosunrise>0 && timeTosunrise < timeTosunset) {
        console.log("Sunrise in: " + risehour + " H  " + risemin + " M  " + risesec + " S");
    } else {
        console.log("Sunset in: " + sethour + " H  " + setmin + " M  " + setsec + " S");
    }

    console.log("Day duration for current latitude:   " + dayhour + " Hrs  " + daymin + " Min  " + daysec + " Sec");
    console.log("Night duration for current latitude: " + nighthour + " Hrs  " + nightmin + " Min  " + nightsec + " Sec");
    console.log('\n');

    return  {
        location: {
            lat: hem  + "  " + latdeg + "°" + "  " + latmin + "'  " + latsec + "''",
            long: direction + "  " + longdeg + "°" + "  " + longmin + "'  " + longsec + "''",
            alt: plheight + "  mts. ASL",
            x: Math.round(rCorrected * Math.sin(angleBetween(invert(green), PL))/100)/10 + " km",
            y: Math.round(rCorrected * Math.cos(angleBetween(green, PL))/100)/10 + " km",
            z: Math.round(Plz / 100)/10 + " km"
        },
        daytime: {
            sunrise: risehour + " H  " + risemin + " M  " + risesec + " S",
            sunset: sethour + " H  " + setmin + " M  " + setsec + " S",
            day: dayhour + " Hrs  " + daymin + " Min  " + daysec + " Sec",
            dayRaw: dayDuration,
            night: nighthour + " Hrs  " + nightmin + " Min  " + nightsec + " Sec",
            nightRaw: nightDuration,
            sun: sun,
            horizon: horizon
        }
    };

}




function createVector(a, b, c) {

    let vec = {
        x: a || 0,
        y: b || 0,
        z: c || 0,
    };

    return vec;
}

function invert(u) {

    const x = u.x * -1;
    const y = u.y * -1;
    const z = u.z * -1;

    let vec = {
        x: x,
        y: y,
        z: z,
    };

    return vec;
}


function angleBetween(u, v) {

    const dotmagmag = dot(u, v) / (mag(u) * mag(v));

    console.log('dotmagmag', dotmagmag)

    let angle;
    angle = Math.acos(Math.min(1, Math.max(-1, dotmagmag)));

    console.log('acos', Math.min(1, Math.max(-1, dotmagmag)))
    console.log('angle', angle)

    angle = angle * Math.sign(cross(u, v).z || 1);

    return angle;
}


function dot(u, v) {

    return u.x * v.x + u.y * v.y + u.z * v.z;
}

function cross(u, v) {

    const x = u.y * v.z - u.z * v.y;
    const y = u.z * v.x - u.x * v.z;
    const z = u.x * v.y - u.y * v.x;

    return createVector(x, y, z);
}

function mag(u) {

    return Math.sqrt(magSq(u));
}

function magSq(u) {

    const x = u.x;
    const y = u.y;
    const z = u.z;

    return x * x + y * y + z * z;
}

function dist(ax, ay, az, bx, by, bz) {

    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;

    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}




function getNearbyBody(Plx, Ply) {

    let planet = '';
    let name = '';
    // all of this is to tell you which planet you are automatically once coords are pasted. Checks if you are within 20 km limit from planet center.
    // it should be changed to ROTATION GRID CONTAINER values, instead of 2000000
    if (Plx < 12850457090 + 2000000 && Plx > 12850457090 - 2000000 &&
        Ply <           0 + 2000000 && Ply >           0 - 2000000) {
        planet = 'hurston';
        name = 'Hurston';
    } else if (Plx < 12892693309 + 2000000 && Plx > 12892653309 - 2000000 &&
        Ply >   -31456129 - 2000000 && Ply <   -31496129 + 2000000) {
        planet = 'arial';
        name = 'Arial, moon of Hurston';
    } else if (Plx < 12905777636 + 2000000 && Plx > 12905737636 - 2000000 &&
        Ply <    40975551 + 2000000 && Ply >    40935551 - 2000000) {
        planet = 'aberdeen';
        name = 'Aberdeen, moon of Hurston';
    } else if (Plx < 12792706359 + 2000000 && Plx > 12792666359 - 2000000 &&
        Ply >   -74444581 - 2000000 && Ply <   -74484581 + 2000000) {
        planet = 'magda';
        name = 'Magda, moon of Hurston';
    } else if (Plx < 12830214716 + 2000000 && Plx > 12830174716 - 2000000 &&
        Ply <   114933609 + 2000000 && Ply >   114893609 - 2000000) {
        planet = 'ita';
        name = 'Ita, moon of Hurston';
    } else if (Plx > -18962156000 - 2000000 && Plx < -18962196000 + 2000000 &&
        Ply >  -2664940000 - 2000000 && Ply <  -2664980000 + 2000000) {
        planet = 'crusader';
        name = 'Crusader';
    } else if (Plx > -18987591119 - 2000000 && Plx < -18987631119 + 2000000 &&
        Ply >  -2708989661 - 2000000 && Ply <  -2709029661 + 2000000) {
        planet = 'cellin';
        name = 'Cellin, moon of Crusader';
    } else if (Plx > -18930519540 - 2000000 && Plx < -18930559540 + 2000000 &&
        Ply >  -2610138765 - 2000000 && Ply <  -2610178765 + 2000000) {
        planet = 'daymar';
        name = 'Daymar, moon of Crusader';
    } else if (Plx > -19022896799 - 2000000 && Plx < -19022936799 + 2000000 &&
        Ply >  -2613976152 - 2000000 && Ply <  -2614016152 + 2000000) {
        planet = 'yela';
        name = 'Yela, moon of Crusader';
    } else if (Plx <  18587684740 + 2000000 && Plx >  18587644740 - 2000000 &&
        Ply > -22151896920 - 2000000 && Ply < -22151936920 + 2000000) {
        planet = 'arccorp';
        name = 'ArcCorp';
    } else if (Plx <  18703627172 + 2000000 && Plx >  18703587172 - 2000000 &&
        Ply > -22121630134 - 2000000 && Ply < -22121670134 + 2000000) {
        planet = 'lyria';
        name = 'Lyria, moon of ArcCorp';
    } else if (Plx <  18379669310 + 2000000 && Plx >  18379629310 - 2000000 &&
        Ply > -22000446768 - 2000000 && Ply < -22000486768 + 2000000) {
        planet = 'wala';
        name = 'Wala, moon of ArcCorp';
    } else if (Plx < 22462236306 + 2000000 && Plx > 22461896306 - 2000000 &&
        Ply < 37185625646 + 2000000 && Ply > 37185625646 - 2000000) {
        planet = 'microtech';
        name = 'microTech';
    } else if (Plx < 22398389308 + 2000000 && Plx > 22398349308 - 2000000 &&
        Ply < 37168860679 + 2000000 && Ply > 37168820679 - 2000000) {
        planet = 'calliope';
        name = 'Calliope, moon of microTech';
    } else if (Plx < 22476748221 + 2000000 && Plx > 22476708221 - 2000000 &&
        Ply < 37091040074 + 2000000 && Ply > 37091000074 - 2000000) {
        planet = 'clio';
        name = 'Clio, moon of microTech';
    } else if (Plx < 22488129736 + 2000000 && Plx > 22488089736 - 2000000 &&
        Ply < 37081143565 + 2000000 && Ply > 37081103565 - 2000000) {
        planet = 'euterpe';
        name = 'Euterpe, moon of microTech';
    } else {
        planet = 'deep space';
    }

    return {planet, name};
}


function getBodyData(planet) {
    // see description for first planet.

    //const bulbx = 136049870;
    //const bulby = 1294427400;
    //const bulbz = 2923345368;

    let data = {
        planetRadius: 0,
        planetX: 0,
        planetY: 0,
        hfullrot: 0,
        anglefacesun: 0,
        planetdistbulb: 0,
        elevhyp: 0,
        declination: 0,
        refX: 0,
        refY: 0,
        refZ: 0,
        refR: 0,
        greenwich_epoch: 0,
        refAngle: 0,
    };


    switch (planet) {

        case 'arccorp':
            data.planetRadius = 800000;          // IN METERS.
            data.planetX =  18587664740 - bulbx; // Converts planet coordinates to a system where the bulb (source of light, stanton) is X= 0, Y= 0.
            data.planetY = -22151916920 - bulby;
            data.hfullrot = 3.1099999;           // full rotation in hours.
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);  // angle facing the sun, terminator line projection orientation.
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY); // distance from planet center to bulb.
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb); // distance in Z plane, to calculate declination
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));

            // this is the value of reference for OM3. Just flew with my aurora to an OM3, and got its /showlocation with a timestamp.
            // should be made again for all planets, as I made it manually with a chronometer very innacurately.
            data.refX =  18586528588 - bulbx - data.planetX;
            data.refY = -22151781403 - bulby - data.planetY;
            data.refZ = 0; // not needed, can be erased.
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612573354000; // timestamp (UNIX or EPOCH time, in miliseconds) for those OM3 coordinates.
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI; // angle between OM3 and planet center.
            if (data.refAngle < 0) {
                data.refAngle = 360 + data.refAngle;
            }
            break;

        case 'lyria':
            data.planetRadius = 223000;
            data.planetX =  18703607172 - bulbx;
            data.planetY = -22121650134 - bulby;
            data.hfullrot = 6.4299998;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX =  18703882943 - bulbx - data.planetX;
            data.refY = -22121828088 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612574065000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'wala':
            data.planetRadius = 283000;
            data.planetX =  18379649310 - bulbx;
            data.planetY = -22000466768 - bulby;
            data.hfullrot = 6.3200002;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX =  18379277917 - bulbx - data.planetX;
            data.refY = -22000285983 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612574554000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'crusader':
            data.planetRadius = 7450000;
            data.planetX = -18962176000 - bulbx;
            data.planetY =  -2664960000 - bulby;
            data.hfullrot = 0;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = -18962176000 - bulbx - data.planetX;
            data.refY =  -2653226253 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612575271000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'cellin':
            data.planetRadius = 260000;
            data.planetX = -18987611119 - bulbx;
            data.planetY =  -2709009661 - bulby;
            data.hfullrot = 4.4499998;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = -18987958826 - bulbx - data.planetX;
            data.refY =  -2708855063 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612575790000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'daymar':
            data.planetRadius = 295000;
            data.planetX = -18930539540 - bulbx;
            data.planetY =  -2610158765 - bulby;
            data.hfullrot = 2.4800000;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = -18930539540 + 295000 - bulbx - data.planetX;
            data.refY =           -2610158765 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 0;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'yela':
            data.planetRadius = 313000;
            data.planetX = -19022916799 - bulbx;
            data.planetY =  -2613996151 - bulby;
            data.hfullrot = 1.8200001;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = -19022485475 - bulbx - data.planetX;
            data.refY =  -2614142523 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612576067000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'hurston':
            data.planetRadius = 1000000;
            data.planetX = 12850457090 - bulbx;
            data.planetY =           0 - bulby;
            data.hfullrot = 2.4800000;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 12849698850 - bulbx - data.planetX;
            data.refY =    -1208937 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612569846000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'aberdeen':
            data.planetRadius = 274000;
            data.planetX = 12905757640 - bulbx;
            data.planetY =    40955551 - bulby;
            data.hfullrot = 2.5999999;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 12905394244 - bulbx - data.planetX;
            data.refY =    41123505 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612570370000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'arial':
            data.planetRadius = 344500.06;
            data.planetX = 12892673309 - bulbx;
            data.planetY =   -31476129 - bulby;
            data.hfullrot = 5.5100002;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 12892224018 - bulbx - data.planetX;
            data.refY =   -31256656 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612571022000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'ita':
            data.planetRadius = 325000;
            data.planetX = 12830194716 - bulbx;
            data.planetY =   114913609 - bulby;
            data.hfullrot = 4.8499999;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 12830035843 - bulbx - data.planetX;
            data.refY =   115358548 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612571338000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'magda':
            data.planetRadius = 340833;
            data.planetX = 12792686360 - bulbx;
            data.planetY =   -74464581 - bulby;
            data.hfullrot = 1.9400001; //game files say rot 0;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 12792593512 - bulbx - data.planetX;
            data.refY =   -73978529 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612570700000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'microtech':
            data.planetRadius = 1000000;
            data.planetX = 22462016306 - bulbx;
            data.planetY = 37185625646 - bulby;
            data.hfullrot = 4.1199999;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 22460998034 - bulbx - data.planetX;
            data.refY = 37186625440 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612566249000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'calliope':
            data.planetRadius = 240000.05;
            data.planetX = 22398369308 - bulbx;
            data.planetY = 37168840679 - bulby;
            data.hfullrot = 4.5900002;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 22488419694 - bulbx - data.planetX;
            data.refY = 37081174138 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612566506000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'clio':
            data.planetRadius = 337166.59;
            data.planetX = 22476728221 - bulbx;
            data.planetY = 37091020074 - bulby;
            data.hfullrot = 3.2500000;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 22476260818 - bulbx - data.planetX;
            data.refY = 37090874132 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612567422000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        case 'euterpe':
            data.planetRadius = 213000.05;
            data.planetX = 22488109736 - bulbx;
            data.planetY = 37081123565 - bulby;
            data.hfullrot = 4.2800002;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY);
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb);
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            data.refX = 22488419694 - bulbx - data.planetX;
            data.refY = 37081174138 - bulby - data.planetY;
            data.refZ = 0;
            data.refR = Math.sqrt(data.refX * data.refX + data.refY * data.refY);
            data.greenwich_epoch = 1612566838000;
            data.refAngle = (Math.atan2(data.refY, data.refX)) * 180 / Math.PI;
            if (data.refAngle < 0) {data.refAngle = 360 + data.refAngle;}
            break;

        default:
            data.planetRadius = 800000;
            data.planetX = 0 - bulbx;
            data.planetY = 0 - bulby;
            data.hfullrot = 0;
            data.anglefacesun = Math.atan2(data.planetY, data.planetX);
            data.planetdistbulb = Math.sqrt(data.planetX * data.planetX + data.planetY * data.planetY)
            data.elevhyp = Math.sqrt(bulbz * bulbz + data.planetdistbulb * data.planetdistbulb)
            data.declination = Math.acos((data.elevhyp * data.elevhyp + data.planetdistbulb * data.planetdistbulb - bulbz * bulbz) / (2 * data.elevhyp * data.planetdistbulb));
            break;
    }

    return data;
}
