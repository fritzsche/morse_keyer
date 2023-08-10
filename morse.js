/* 
 * Details about squeeze keying as documented by DJ5IL
 * http://cq-cq.eu/DJ5IL_rt007.pdf
 */


const code_map = [
    [/<ka>/, '-.-.-'], // Message begins / Start of work 
    [/<sk>/, '...-.-'], //  End of contact / End of work
    [/<ar>/, '.-.-.'], // End of transmission / End of message
    [/<kn>/, '-.--.'], // Go ahead, specific named station.
    [/=/, '-...-'],
    [/a/, '.-'],
    [/b/, '-...'],
    [/c/, '-.-.'],
    [/d/, '-..'],
    [/e/, '.'],
    [/f/, '..-.'],
    [/g/, '--.'],
    [/h/, '....'],
    [/i/, '..'],
    [/j/, '.---'],
    [/k/, '-.-'],
    [/l/, '.-..'],
    [/m/, '--'],
    [/n/, '-.'],
    [/o/, '---'],
    [/p/, '.--.'],
    [/q/, '--.-'],
    [/r/, '.-.'],
    [/s/, '...'],
    [/t/, '-'],
    [/u/, '..-'],
    [/v/, '...-'],
    [/w/, '.--'],
    [/x/, '-..-'],
    [/y/, '-.--'],
    [/z/, '--..'],
    [/1/, '.----'],
    [/2/, '..---'],
    [/3/, '...--'],
    [/4/, '....-'],
    [/5/, '.....'],
    [/6/, '-....'],
    [/7/, '--...'],
    [/8/, '---..'],
    [/9/, '----.'],
    [/0/, '-----'],
    [/'/, '.-.-.-'],
    [/,/, '--..--'],
    [/\?/, '..--..'],
    [/'/, '.----.'],
    [/\//, '-..-.'],
    [/\./, '.-.-.-'],
    [/ä/, '.--.-'],
    [/ö/, '---.'],
    [/ü/, '..--'],
    [/ß/, '...--..'],
    [/\!/, '-.-.--'],
    [/\s+/, ' '], // whitespace is trimmed to single char
    [/./, ''] // ignore all unknown char
];


class Morse {
    constructor(ctx, wpm = 20, freq = 650, farnsworth = 999) {


        this._ctx = ctx; // web audio context

        this._gain = this._ctx.createGain()
        this._gain.connect(this._ctx.destination)
        //        const clip_vol = 1.8 * Math.exp(-0.115 * 12 )
        this._gain.gain.value = 0.5 * 0.5 * 0.6

        this._lpf = this._ctx.createBiquadFilter()
        this._lpf.type = "lowpass"
        this._lpf.frequency.setValueAtTime(freq, this._ctx.currentTime)
        this._lpf.Q.setValueAtTime(12, this._ctx.currentTime)
        this._lpf.connect(this._gain)

        this._cwGain = this._ctx.createGain()
        this._cwGain.gain.value = 0
        this._cwGain.connect(this._lpf)

        this._oscillator = this._ctx.createOscillator()
        this._oscillator.type = 'sine'
        this._oscillator.frequency.setValueAtTime(freq, this._ctx.currentTime)
        this._oscillator.connect(this._cwGain)
        this._oscillator.start()

        this._runId = 0;
        this._currPos = 0;
        this._state = 'INITIAL'

        this._wpm = Number(wpm);
        this._ditLen = this._ditLength(wpm * 5)
        this._farnsworth = Number(farnsworth)
        if (this._farnsworth > this._wpm) this._farnsworth = this._wpm
        this._spaceDitLen = this._ditLength(this._farnsworth * 5)

        this.frequency = freq

    }

    set wpm(w) {
        if (this._wpm === Number(w)) return
        this._wpm = Number(w)
        this._ditLen = this._ditLength(this._wpm * 5)
        if (this._farnsworth > this._wpm) this._farnsworth = this._wpm
        this._spaceDitLen = this._ditLength(this._farnsworth * 5)
        if (this._state !== 'INITIAL') {
            this._seqence = this._seqenceEvents(this._conv_to_morse(this._text));
            this._startTime = this._ctx.currentTime - this._seqence[this._currPos].time;
        }
    }

    set farnsworth(f) {
        if (this._farnsworth === f) return;
        this._farnsworth = Number(f);
        if (this._farnsworth > this._wpm) this._farnsworth = this._wpm;
        this._spaceDitLen = this._ditLength(this._farnsworth * 5);
        // need to recalc sequence
        if (this._state !== 'INITIAL') {
            this._seqence = this._seqenceEvents(this._conv_to_morse(this._text));
            this.startTime = this._ctx.currentTime - this._seqence[this._currPos].time;
        }
    }


    set text(txt) {
        if (this._text === txt) return;
        this._text = txt;
        this._currPos = 0;
        this._seqence = this._seqenceEvents(this._conv_to_morse(txt));
    }

    set displayCallback(callback) {
        this._displayCallback = callback;
    }


    set frequency(freq = 650) {
        this._freq = freq;

        this._lpf.frequency.setValueAtTime(freq, this._ctx.currentTime)
        this._oscillator.frequency.setValueAtTime(freq, this._ctx.currentTime)
    }


    get state() {
        return this._state;
    }

    start() {
        if (audioCtx.state !== 'running') {
            audioCtx.resume().then(() => this._morsePlay());
        } else this._morsePlay();
    }
    stop() {
        this._runId++
        this._state = 'STOPPED'
        this._cwGain.gain.cancelScheduledValues(this._ctx.currentTime)
        this._cwGain.gain.value = 0
        console.log(this._scheduled)
        //       this._currPos -= this._scheduled
        const time = this._ctx.currentTime - this._startTime
        console.log("time ", time)
        clearTimeout(this._stopTimer)
        // in case we already schedules all entries we need to set 
        // position to last element
        if (this._currPos >= this._seqence.length) this._currPos = this._seqence.length - 1
        for (; ;) {

            console.log(this._currPos, this._seqence[this._currPos].time, time, this._seqence[this._currPos].action)
            const seq = this._seqence[this._currPos]

            if ((time >= seq.time && seq.action === 'DISPLAY') || this._currPos == 0) break;
            this._currPos--
        }
        for (const timer of this._scheduled) {
            clearTimeout(timer)
            console.log("Clear" + timer)
        }
    }
    // https://github.com/cwilso/metronome/
    // https://www.html5rocks.com/en/tutorials/audio/scheduling/
    _morsePlay() {
        console.log("play ", this._currPos, this._seqence.length)
        if (this._currPos >= this._seqence.length) this._currPos = 0
        switch (this._state) {
            case 'INITIAL':
                this._startTime = this._ctx.currentTime + 0.01
                break;
            case 'STOPPED':
                this._startTime = this._ctx.currentTime - this._seqence[this._currPos].time;
                break;
            //            case 'ENDED':
            //                this._currPos = 0;
            //               this._startTime = this._ctx.currentTime + 0.01
            //                break;
        }
        this._state = 'STARTED';
        // start time of the current player sequence
        let ahead = this._ditLen * 100; // number of time we look ahead for new events to play
        this._runId++;
        let currRun = this._runId;
        this._scheduled = []
        // schedule event regular     
        let scheduled = () => {

            if (currRun !== this._runId) return;
            let reschedule = true
            let current = this._ctx.currentTime;
            let delta = current - this._startTime;
            for (; ;) {
                if (this._currPos >= this._seqence.length) {
                    reschedule = false
                    if (this._seqence.length > 0) {
                        let ev = this._seqence[this._currPos - 1]

                        let milis = (ev.time - (current - this._startTime)) * 1000;
                        this._stopTimer = setTimeout(() => {
                            // executing now the first element in the scheduled events.
                            // need to remove it from array
                            this._state = 'INITIAL';
                            console.log("set initial")
                            this._currPos = 0;

                        }, milis);
                    }
                    // this._gain.gain.exponentialRampToValueAtTime(0, this._ctx.currentTime + 1.00)
                    break; // exit look if current position reach end
                }
                let ev = this._seqence[this._currPos]; // pick current event
                if (ev.time < delta + ahead) { // check the event is part of current lookahead
                    this._currPos++;
                    switch (ev.action) {
                        case 'PLAY': {
                            switch (ev.tone) {
                                case '.': {
                                    this._cwGain.gain.setValueAtTime(1, this._startTime + ev.time)
                                    this._cwGain.gain.setValueAtTime(0, this._startTime + ev.time + this._ditLen)
                                    break;
                                }
                                case '_': {
                                    this._cwGain.gain.setValueAtTime(1, this._startTime + ev.time)
                                    this._cwGain.gain.setValueAtTime(0, this._startTime + ev.time + (this._ditLen * 3))
                                    break;
                                }
                            }
                            break;
                        }
                        case 'DISPLAY': {
                            let milis = (ev.time - (current - this._startTime)) * 1000;
                            const timerId = setTimeout(() => {
                                // executing now the first element in the scheduled events.
                                // need to remove it from array
                                this._scheduled.shift()
                                if (this._displayCallback) this._displayCallback(ev);
                            }, milis);
                            // Schedule gui event 
                            this._scheduled.push(timerId)
                            console.log("add", timerId)
                            break;
                        }
                    }
                } else break;
            }
            if (this._state === 'STARTED' && reschedule) setTimeout(scheduled, (ahead * 1000) / 3);
        }
        scheduled();
    }

    _seqenceEvents(conv) {
        let seq = [];
        let current = 0;
        let currDits = 0;
        let currSpaceDits = 0;
        let currText = "";

        conv.forEach(letter => {
            switch (letter.pattern) {
                case ' ':
                    currText += ' ';
                    //                    seq.push({ time: current, dits: currDits, spaces: currSpaceDits, action: 'DISPLAY', value: ' ', text: currText });
                    current += this._spaceDitLen * 7;
                    currSpaceDits += 7;
                    seq.push({
                        time: current,
                        dits: currDits,
                        spaces: currSpaceDits,
                        action: 'DISPLAY',
                        value: ' ',
                        text: currText
                    });
                    break
                case '*':
                    current += this._spaceDitLen * 3
                    currSpaceDits += 3
                    break
                default:
                    let word = letter.pattern.split("").join("*");
                    currText += letter.text;
                    //                    seq.push({ time: current, dits: currDits, spaces: currSpaceDits, action: 'DISPLAY', value: letter.text, text: currText });
                    [...word].forEach(tone => {
                        currDits++;
                        switch (tone) {
                            case '.':
                                seq.push({
                                    time: current,
                                    dits: currDits,
                                    spaces: currSpaceDits,
                                    action: 'PLAY',
                                    tone: '.'
                                });
                                current += this._ditLen;
                                break
                            case '-':
                                seq.push({
                                    time: current,
                                    dits: currDits,
                                    spaces: currSpaceDits,
                                    action: 'PLAY',
                                    tone: '_'
                                });
                                current += this._ditLen * 3
                                currDits += 2
                                break
                            case '*':
                                current += this._ditLen;
                                break
                            default:
                                debugger
                        }
                    });
                    seq.push({
                        time: current,
                        dits: currDits,
                        spaces: currSpaceDits,
                        action: 'DISPLAY',
                        value: letter.text,
                        text: currText
                    });
                    break;
            }
        })
        return seq;
    }

    _conv_to_morse(str) {
        let low_str = str.toLowerCase();
        let offset = 0;
        let last_is_char = false;
        var result = [];
        for (; ;) {
            let length = 0;
            let pattern = "";
            for (let i = 0; i < code_map.length; i++) {
                let reg = code_map[i][0];
                let found = low_str.substr(offset).match(reg);
                if (found && found.index == 0) {
                    pattern = code_map[i][1];
                    length = found[0].length;
                    break;
                }
            }
            if (pattern != '') {
                if (pattern == ' ') {
                    result.push({
                        pattern: pattern
                    })
                    last_is_char = false;
                } else {
                    if (last_is_char) result.push({
                        pattern: '*'
                    });
                    result.push({
                        pattern: pattern,
                        offset: offset,
                        length: length,
                        text: low_str.substr(offset, length)
                    });
                    last_is_char = true;
                }
            }
            offset += length;
            if (offset === low_str.length) break;
        }
        return (result);
    }

    _ditLength(cpm) {
        // The standard word "PARIS" has 50 units of time. 
        // .--.  .-  .-.  ..  ... ==> "PARIS"
        // 10 dit + 4 dah + 9 dit space + 4 dah space = 19 dit + 24 dit = 43 dit.
        // 43 dit + 7 dit between words results in 50 dits total time
        //
        // 100cpm (character per minute) 
        // means we need to give 20 times to word "PARIS".
        // means we give 20 times 50 units of time = 1000 units of time per minute (or 60 seconds).
        // 60 seconds devided by 1000 unit of time, means each unit (dit) takes 60ms.
        // Means at  speed of 100 cpm  a dit has 60ms length
        // length of one dit in s = ( 60ms * 100 ) / 1000        
        const cpmDitSpeed = (60 * 100) / 1000;
        return cpmDitSpeed / cpm;
    }
}

const DIT = '.'
const DAH = '-'
const NONE = 'X'


const DOWN = 1
const UP = 2


const morse_map = {
    // alpha
    '.-': 'a',
    '-...': 'b',
    '-.-.': 'c',
    '-..': 'd',
    '.': 'e',
    '..-.': 'f',
    '--.': 'g',
    '....': 'h',
    '..': 'i',
    '.---': 'j',
    '-.-': 'k',
    '.-..': 'l',
    '--': 'm',
    '-.': 'n',
    '---': 'o',
    '.--.': 'p',
    '--.-': 'q',
    '.-.': 'r',
    '...': 's',
    '-': 't',
    '..-': 'u',
    '...-': 'v',
    '.--': 'w',
    '-..-': 'x',
    '-.--': 'y',
    '--..': 'z',
    // numbers   
    '.----': '1',
    '..---': '2',
    '...--': '3',
    '....-': '4',
    '.....': '5',
    '-....': '6',
    '--...': '7',
    '---..': '8',
    '----.': '9',
    '-----': '0',
    // punctuation   
    '--..--': ',',
    '..--..': '?',
    '.-.-.-': '.',
    '-...-': '=',
    // Deutsche Umlaute
    '.--.-': 'ä',
    '---.': 'ö',
    '..--': 'ü',
    '...--..': 'ß',
    '-.-.--': '!',
    '-.-.-': '<ka>', // Message begins / Start of work 
    '...-.-': '<sk>', //  End of contact / End of work
    '.-.-.': '<ar>', // End of transmission / End of message
    '-.--.': '<kn>' // Go ahead, specific named station.    
}


class MorseKeyer {
    constructor(volume = 100, wpm = 25, freq = 600, callback, keyMode) {
        this._started = false
        this._wpm = Number(wpm)
        this._freq = Number(freq)
        this._volume = Number(volume)
        this._ditLen = this._ditLength(this._wpm * 5)

        // set if dit/dah-key's pressed
        this._ditKey = UP
        this._dahKey = UP

        // memory a pressed dit key while dah key is pressed
        this._ditMemory = false
        // memory a pressed dah key while dit key is pressed
        this.dahMemory = false

        // set true while both paddels are pressed
        this._iambic = false

        // active while keys are pressed and memory is processed (main loop)
        this._ticking = false

        // the last element executed (e.g. to issue alternating elements on iambic action)
        this._lastElement = NONE
        // elements of the current letter are stored here
        this._currentLetter = ""
        this._displayCallback = displayCallback
        this._lastTime = 0

        if (key === "CURTIS_A")
            this, _keyerMode = 'A';
        else this._keyerMode = 'B'
    }


    _ditLength(cpm) {
        // The standard word "PARIS" has 50 units of time. 
        // .--.  .-  .-.  ..  ... ==> "PARIS"
        // 10 dit + 4 dah + 9 dit space + 4 dah space = 19 dit + 24 dit = 43 dit.
        // 43 dit + 7 dit between words results in 50 dits total time
        //
        // 100cpm (character per minute) 
        // means we need to give 20 times to word "PARIS".
        // means we give 20 times 50 units of time = 1000 units of time per minute (or 60 seconds).
        // 60 seconds devided by 1000 unit of time, means each unit (dit) takes 60ms.
        // Means at  speed of 100 cpm  a dit has 60ms length
        // length of one dit in s = ( 60ms * 100 ) / 1000        
        const cpmDitSpeed = (60 * 100) / 1000;
        return cpmDitSpeed / cpm;
    }

    _displayLetter(l) {
        if (this._displayCallback) this._displayCallback(l)
    }

    _appendElement(e) {
        // to detect we need to output a space (intra word distance) 
        // we check to see at least 6 dits since the last character end. 
        // Detail are 7 dit length but 6 is for more tolerance        
        let delta = 0
        let now = (new Date()).getTime()
        if (this._lastTime > 0 && this._currentLetter === "") delta = Math.abs(now - this._lastTime)
        if (delta > 6 * this._ditLen * 1000) this._displayLetter(' ')
        // append element to build letters
        this._currentLetter += e
    }

    playElement(e) {
        console.log("Element: " + e)
        this._appendElement(e)
        this._lastElement = e
        this._cwGain.gain.setValueAtTime(1, this._ctx.currentTime)
        if (e === DIT) {
            this._cwGain.gain.setValueAtTime(0, this._ctx.currentTime + this._ditLen)
            setTimeout(() => { this.tick() }, 2 * this._ditLen * 1000)
        } else {
            this._cwGain.gain.setValueAtTime(0, this._ctx.currentTime + 3 * this._ditLen)
            setTimeout(() => { this.tick() }, 4 * this._ditLen * 1000)
        }
    }

    set volume(vol = 50) {
        this.start()
 //       debugger;
        this._volume = vol
        console.log("volume " + this._volume)
        let v = Math.pow(this._volume / 100, 3)  ////Math.exp( this._volume )
        console.log("WRITE VOL " + v)

        this._totalGain.gain.exponentialRampToValueAtTime(v, this._ctx.currentTime ) //+ 0.03
    }

    set wpm(wpm = 50) {
        this._wpm = wpm
        this._ditLen = this._ditLength(this._wpm * 5)
    }

    set frequency(freq = 650) {
        this.start()
        this._freq = freq
        this._oscillator.frequency.setValueAtTime(this._freq, this._ctx.currentTime)
        this._lpf.frequency.setValueAtTime(this._freq, this._ctx.currentTime)
    }

    set keyer(key = 'CURTIS_B') {
        if (key === 'CURTIS_B') {
            this._keyerMode = 'B'
        } else this._keyerMode = 'A'
    }

    start() {
        if (this._started === false) {
     //       debugger;
            this._started = true
            this._ctx = new (window.AudioContext || window.webkitAudioContext)() // web audio context


            this._analyser = this._ctx.createAnalyser()
            this._analyser.fftSize = 32768 
            this._bufferLength = this._analyser.frequencyBinCount
            this._dataArray = new Uint8Array(this._bufferLength)

            this._analyser.connect(this._ctx.destination)
//            this._analyser.connect(this._ctx.destination)            

            this._gain = this._ctx.createGain()
//            this._gain.connect(this._ctx.destination)
            this._gain.connect(this._analyser)            

            this._gain.gain.value = 0.5 * 0.5 * 0.6 // * (this._volume / 100)

            this._lpf = this._ctx.createBiquadFilter()
            this._lpf.type = "lowpass"

            this._lpf.frequency.setValueAtTime(500, this._ctx.currentTime)
            this._lpf.Q.setValueAtTime(20, this._ctx.currentTime)

//            this._lpf.frequency.setValueAtTime(this._freq, this._ctx.currentTime)
//            this._lpf.Q.setValueAtTime(12, this._ctx.currentTime) 

            
            this._lpf.connect(this._gain)

            this._cwGain = this._ctx.createGain()
            this._cwGain.gain.value = 0
            this._cwGain.connect(this._lpf)

            this._totalGain = this._ctx.createGain()
//            this._totalGain.gain.value = 0.5
            this.volume = this._volume
            this._totalGain.connect(this._cwGain)

       //     this.volume = this._volume

            this._oscillator = this._ctx.createOscillator()
            this._oscillator.type = 'sine'
            this._oscillator.frequency.setValueAtTime(this._freq, this._ctx.currentTime)
            this._oscillator.connect(this._totalGain)

            this._oscillator.start()

        }
    }


    draw() {


 //       this._analyser.getByteTimeDomainData(this._dataArray)
        
        
    //    drawVisual = requestAnimationFrame(draw);
        let canvas = document.getElementById("viz")
        let WIDTH = canvas.width;
        let HEIGHT = canvas.height;
        
        let canvasCtx = canvas.getContext("2d");
        this._analyser.getByteTimeDomainData(this._dataArray);
     //   console.log(this._dataArray)
 
      
        canvasCtx.fillStyle = "rgb(200, 200, 200)";
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
      
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(0, 0, 0)";
      
        const sliceWidth = (WIDTH * 1.0) / this._bufferLength;
        let x = 0;
      
        canvasCtx.beginPath();
        for (let i = 0; i < this._bufferLength; i++) {
          const v = this._dataArray[i] / 128.0;
          const y = (v * HEIGHT) / 2;
      
          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
      
          x += sliceWidth;
        }
      
        canvasCtx.lineTo(WIDTH, HEIGHT / 2);
        canvasCtx.stroke();
      }


    tick() {
        this.draw()
        // called at begin of each tick        
        this._ticking = true
        if (this._keyerMode === 'B') {
            // Curtis B
            // We have played dit and start dah. If Dit memory in not set it will be set
            if (this._lastElement === DIT && this._iambic && !this._ditMemory) {
                console.log("IAMBIC B")
                this._dahMemory = true
                // We have played a dah and start with did. If Dah memory is not set it will be st
            } else if (this._lastElement === DAH && this._iambic && !this._dahMemory) {
                console.log("IAMBIC B")
                this._ditMemory = true
            }
        }

        // check dit memory 
        if (this._ditMemory && this._lastElement === DAH) {
            // delete memory
            console.log("Dit Memory")
            this._ditMemory = false
            this.playElement(DIT)
            return
        }
        // check dah memory
        if (this._dahMemory && this._lastElement === DIT) {
            // delete memory
            console.log("Dah Memory")
            this._dahMemory = false
            this.playElement(DAH)
            return
        }
        // check if iambic action is ongoing
        if (this._iambic) {
            console.log("iambic" + this._lastElement)

            if (this._lastElement === DIT) {
                this.playElement(DAH)
                return
            } else {
                this.playElement(DIT)
                return
            }
        }
        // check left key
        if (this._ditKey === DOWN && this._dahKey === UP) {
            this.playElement(DIT)
            return
        }
        // check right key        
        if (this._ditKey === UP && this._dahKey === DOWN) {
            this.playElement(DAH)
            return
        }
        // stop if no element was played
        this._ticking = false
        // identify letter
        this._lastTime = (new Date()).getTime()
        if (morse_map[this._currentLetter])
            this._displayLetter(morse_map[this._currentLetter]);
        else this._displayLetter('*')
        this._currentLetter = ""
    }


    keydown(key) {
        this.start()
        // only DAH key
        if (key === DAH && this._dahKey === UP) {
            this._dahKey = DOWN
            if (this._ticking) {
                console.log("set dah Memory")
                this._dahMemory = true
            }
        }
        // only dit
        else if (key === DIT && this._ditKey === UP) {
            this._ditKey = DOWN
            if (this._ticking) {
                console.log("set dit Memory")
                this._ditMemory = true
            }
        }
        // both keys
        if (this._ditKey === DOWN && this._dahKey === DOWN) this._iambic = true

        if (!this._ticking) this.tick()
    }

    keyup(key) {
        console.log("up")
        this.start()
        this._iambic = false
        if (key === DAH) this._dahKey = UP; else this._ditKey = UP
    }
}

// focus text box on load
window.onload = function () {
    // https://stackoverflow.com/questions/7944460/detect-safari-browser    
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

    window.focus()

    // to stop key repeats that can happen on windows.
    // We store all keydowns received and set to false once key up.
    // so if we get keydow twice we will only recognize it one time.
    var keyAllowed = {}

    // restore settings from local storage
    let setting = JSON.parse(localStorage.getItem("setting"));
    if (setting) {
        document.getElementById("vol").value = setting.vol
        document.getElementById("wpm").value = setting.wpm
        document.getElementById("freq").value = setting.freq
        document.getElementById("key").value = setting.key
    }

    let vol = parseInt(document.getElementById("vol").value)
    let wpm = parseInt(document.getElementById("wpm").value)
    let freq = parseInt(document.getElementById("freq").value)
    let key = document.getElementById("key").value

    // define function to update the letters detected
    const out = document.getElementById("out")
    const callBack = displayCallback = (text) => {
        out.textContent += text;
        out.scrollTop = out.scrollHeight;
    }

    let morseKeyer = new MorseKeyer(vol, wpm, freq, callBack, key)

    const storeSetting = function (e) {
        let config = {
            vol: document.getElementById("vol").value,
            wpm: document.getElementById("wpm").value,
            freq: document.getElementById("freq").value,
            key: document.getElementById("key").value,
        }
        console.log("conf write")
        morseKeyer.volume = config.vol
        morseKeyer.wpm = config.wpm
        morseKeyer.frequency = config.freq
        morseKeyer.keyMode = config.key
        localStorage.setItem("setting", JSON.stringify(config))
    }

    document.getElementById("vol").onchange = storeSetting
    document.getElementById("freq").onchange = storeSetting
    document.getElementById("wpm").onchange = storeSetting
    document.getElementById("key").onchange = storeSetting

    document.getElementById("freq_value").textContent = document.getElementById("freq").value
    document.getElementById("freq").addEventListener("input", (event) => {
        document.getElementById("freq_value").textContent = event.target.value;
    });


    document.getElementById("wpm_value").textContent = document.getElementById("wpm").value
    document.getElementById("wpm").addEventListener("input", (event) => {
        document.getElementById("wpm_value").textContent = event.target.value;
    });

    window.onkeydown = function (e) {
        // Problem in Safari: it return 2nd key down event if both ctrl key pressed instead of keyup
        // this prevents multiple keydowns on windows 
        if (!isSafari && keyAllowed[e.code] === false) return;
        keyAllowed[e.code] = false
        console.log("down " + e.code)
        if (e.code === "ShiftLeft" || e.code === "ControlLeft" || e.code === "Period") {
            if (isSafari && morseKeyer._ditKey === DOWN) morseKeyer.keyup(DIT);
            else morseKeyer.keydown(DIT)
        }
        if (e.code === "ShiftRight" || e.code === "ControlRight" || e.code === "Slash") {
            if (isSafari && morseKeyer._dahKey === DOWN) morseKeyer.keyup(DAH);
            else morseKeyer.keydown(DAH)
        }
    }
    window.onkeyup = function (e) {
        keyAllowed[e.code] = true;
        console.log("up " + e.code)
        if (e.code == "ShiftLeft" || e.code === "ControlLeft" || e.code === "Period") {
            morseKeyer.keyup(DIT)
        }
        if (e.code == "ShiftRight" || e.code === "ControlRight" || e.code === "Slash") {
            morseKeyer.keyup(DAH)
        }
    }
}