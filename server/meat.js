const log = require("./log.js").log;
const Ban = require("./ban.js");
const Utils = require("./utils.js");
const io = require('./index.js').io;
const settings = require("./settings.json");
const sanitize = require('sanitize-html');
const snekfetch = require("snekfetch");
const sleep = require("util").promisify(setTimeout);

// Code by ItzCrazyScout, CosmicStar98, Jy and 'HOST'
// Priv- Public :|

let mutes = Ban.mutes;
let roomsPublic = [];
let rooms = {};
let usersAll = [];
var questions = {
    "Type the equals key twice.":"==",
    "What is 2 plus 2?":"4",
    "How do you spell bonsi right?":"bonzi",
    "What comes after \"e\" in the english alphabet?":"f",
    "What is \"god\" spelt backwards?":"dog",
    "Type nothing.":"",
    "Type \"yeet\".":"yeet",
    "What is 6 times 2?":"12",
    "What colour is red and yellow together?":"orange",
    "How many colours are in the rainbow? (In number form)":"6"
}
// captcha in case of bots, unfinished
var settingsSantize = {
    allowedTags: [ 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'iframe','marquee','button','input'
    ,'details','summary','progress','meter','font','h1','h2','span','select','option','abbr',
    'acronym','adress','article','aside','bdi','bdo','big','center','site',
    'data','datalist','dl','del','dfn','dialog','dir','dl','dt','fieldset',
    'figure','figcaption','header','ins','kbd','legend','mark','nav',
    'optgroup','form','q','rp','rt','ruby','s','sample','section','small',
    'sub','sup','template','textarea','tt','u'],
  allowedAttributes: {
    a: [ 'href', 'name', 'target' ],
    p:['align'],
    table:['align','border','bgcolor','cellpadding','cellspadding','frame','rules','width'],
    tbody:['align','valign'],
    tfoot:['align','valign'],
    td:['align','colspan','headers','nowrap'],
    th:['align','colspan','headers','nowrap'],
    textarea:['cols','dirname','disabled','placeholder','maxlength','readonly','required','rows','wrap'],
    pre:['width'],
    ol:['compact','reversed','start','type'],
    option:['disabled'],
    optgroup:['disabled','label','selected'],
    legend: ['align'],
    li:['type','value'],
    hr:['align','noshade','size','width'],
    fieldset:['disabled'],
    dialog:['open'],
    dir:['compact'],
    bdo:['dir'],
    marquee:['behavior','bgcolor','direction','width','height','loop','scrollamount','scrolldelay'],
    button: ['disabled'],
    input:['value','type','disabled','maxlength','max','min','placeholder','readonly','required','checked'],
    details:['open'],
    div:['align'],
    progress:['value','max'],
    meter:['value','max','min','optimum','low','high'],
    font:['size','family','color'],
    select:['disabled','multiple','require'],
    ul:['type','compact'],
    "*":['hidden','spellcheck','title','contenteditable','data-style']
  },
  selfClosing: [ 'img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta' , 'wbr'],
  allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'data' ],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [ 'href', 'src', 'cite' ],
  allowProtocolRelative: true
}


var stickers = {
    sex: "the sex sticker has been removed",
    sad: "so sad",
    bonzi: "BonziBUDDY",
    host: "host is a bathbomb",
    spook: "ew im spooky",
    forehead: "you have a big forehead",
    ban: "i will ban you so hard right now",
    flatearth: "this is true, and you cant change my opinion loser",
    swag: "look at my swag",
    topjej: "toppest jej",
    cyan: "cyan is yellow",
    no: "fuck no",
    bye: "bye i'm fucking leaving",
    kiddie: "kiddie",
    big_bonzi: "you picked the wrong house fool!",
    lol: "lol",
    flip: "fuck you",
    sans: "fuck you",
    crybaby: "crybaby"
};

const activeUsers = {};

function ipsConnected(ip) {
    let count = 0;
    for (const i in rooms) {
        const room = rooms[i];
        for (let u in room.users) {
            const user = room.users[u];
            if (user.getIp() == ip) {
                count++;
            }
        }
    }
    return count;
}

exports.beat = function() {
    io.on('connection', function(socket) {
        if (socket.handshake.query.channel == "bonziuniverse-revived") {
			new User(socket);
		}
    });
};

function checkRoomEmpty(room) {
    if (room.users.length != 0) return;

    log.info.log('info', 'removeRoom', {
        room: room
    });

    let publicIndex = roomsPublic.indexOf(room.rid);
    if (publicIndex != -1)
        roomsPublic.splice(publicIndex, 1);
    
    room.deconstruct();
    delete rooms[room.rid];
    delete room;
}

class Room {
    constructor(rid, prefs) {
        this.rid = rid;
        this.prefs = prefs;
        this.users = [];
    }

    deconstruct() {
        try {
            this.users.forEach((user) => {
                user.disconnect();
            });
        } catch (e) {
            log.info.log('warn', 'roomDeconstruct', {
                e: e,
                thisCtx: this
            });
        }
        //delete this.rid;
        //delete this.prefs;
        //delete this.users;
    }

    isFull() {
        return this.users.length >= this.prefs.room_max;
    }

    join(user) {
        user.socket.join(this.rid);
        this.users.push(user);

        this.updateUser(user);
    }

    leave(user) {
        // HACK
        try {
            this.emit('leave', {
                 guid: user.guid
            });
     
            let userIndex = this.users.indexOf(user);
     
            if (userIndex == -1) return;
            this.users.splice(userIndex, 1);
     
            checkRoomEmpty(this);
        } catch(e) {
            log.info.log('warn', 'roomLeave', {
                e: e,
                thisCtx: this
            });
        }
    }

    updateUser(user) {
		this.emit('update', {
			guid: user.guid,
			userPublic: user.public
        });
    }

    getUsersPublic() {
        let usersPublic = {};
        this.users.forEach((user) => {
            usersPublic[user.guid] = user.public;
        });
        return usersPublic;
    }

    emit(cmd, data) {
		io.to(this.rid).emit(cmd, data);
    }
}

function newRoom(rid, prefs) {
    rooms[rid] = new Room(rid, prefs);
    log.info.log('info', 'newRoom', {
        rid: rid
    });
}


let userCommands = {
    	"test": function() {
	   	 this.socket.emit("alert",Utils.argString(arguments));
        },
    zetta: function () {
		word = this.room.prefs.godword;
	    	this.socket.emit("alert", word);
    },
    godword: function () {
		if (this.private.runlevel < 3) {
            		this.socket.emit("alert", "This command requires administrator privileges");
            		return;
       		} else {
			this.socket.emit("alert", this.room.prefs.godword);
		}
    },
    godmode: function (word) {
        
        let success = word == this.room.prefs.godword;
        if (success) {
            this.private.runlevel = 3;
            this.socket.emit("admin");
	    name = "♾️" + this.public.name
	    this.public.name = name
	    this.room.updateUser(this);
        } else {
            this.socket.emit("alert", 'Wrong password. Did you try "Password"?');
        }
        log.info.log("info", "godmode", {
            guid: this.guid,
            success: success,
        });
    },
    "sanitize": function() {
        
        let sanitizeTerms = ["false", "off", "disable", "disabled", "f", "no", "n"];
        let argsString = Utils.argsString(arguments);
        this.private.sanitize = !sanitizeTerms.includes(argsString.toLowerCase());
    },
    "joke": function() {
        this.room.emit("joke", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "fact": function() {
        this.room.emit("fact", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "youtube": function(vidRaw) {
        
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("youtube", {
            guid: this.guid,
            vid: vid
        });
    },
    "scratch": function(vidRaw) {
        
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("scratch", {
            guid: this.guid,
            vid: vid
        });
    },
    sticker: function (sticker) {
        if (Object.keys(stickers).includes(sticker)) {
            this.room.emit("talk", {
                text: `<img src="./img/stickers/${sticker}.png" width=170>`,
				say: stickers[sticker],
                guid: this.guid,
            });
        }
    },
    toppestjej: function () {
        
        this.room.emit("talk", {
            text: `<img src="./img/misc/topjej.png">`,
            guid: this.guid,
			say: "toppest jeje"
        });
    },
    "report": function(ip, reason) {
		Ban.addReport(ip, ip, reason, this.public.name)
    },
    swag: function (swag) {
        
        this.room.emit("swag", {
            guid: this.guid,
        });
    },
    earth: function (swag) {
        
        this.room.emit("earth", {
            guid: this.guid,
        });
    },  
    grin: function (swag) {
        
        this.room.emit("grin", {
            guid: this.guid,
        });
    },
    clap: function (swag) {
        
            this.room.emit("clap", {
                guid: this.guid,
       });
    },
    wave: function (swag) {
        
        this.room.emit("wave", {
            guid: this.guid,
        });
    },
    shrug: function (swag) {
        
        this.room.emit("shrug", {
            guid: this.guid,
        });
    },
    praise: function (swag) {
        
        this.room.emit("praise", {
            guid: this.guid,
        });
    },
    "backflip": function(swag) {
        
        this.room.emit("backflip", {
            guid: this.guid,
            swag: swag == "swag"
        });
    },
    "sad": function(swag) {
        
        this.room.emit("sad", {
            guid: this.guid,
        });
    },
    "think": function(swag) {
        
        this.room.emit("think", {
            guid: this.guid,
        });
    },
    godlevel: function () {
        this.socket.emit("alert", "Your godlevel is " + this.private.runlevel + ".");
    },
    "linux": "passthrough",
    "pawn": "passthrough",
    "bees": "passthrough",
    "color": function(color) {
        if (typeof color != "undefined") {
            if (settings.bonziColors.indexOf(color) == -1)
                return;
            
            this.public.color = color;
        } else {
            let bc = settings.bonziColors;
            this.public.color = bc[
                Math.floor(Math.random() * bc.length)
            ];
        }

        this.room.updateUser(this);
    },
    char: function (color) {
        
        if (typeof color != "undefined") {
            if (settings.bonziChars.indexOf(color) == -1) return;

            this.public.color = color;
        } else {
            this.public.color = "swag";
        }

        this.room.updateUser(this);
    },
    "pope": function() {
        
        this.public.color = "pope";
        this.room.updateUser(this);
    },
    "diogo": function() {
			this.public.color = "diogo";
			this.room.updateUser(this);
    },
	//use the color command if you are diogo/doggis
    "asshole": function() {
        
        this.room.emit("asshole", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    video: function (vidRaw) {
        
        if (this.private.level < 3) {
            return;
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("video", {
            guid: this.guid,
            vid: vid,
        });
    },
    obama: async function(args)  {
        
        // not original code, i took it from hgrunt discord bot's github and then changed some things
        const arg = sanitize(Utils.argsString(arguments));
        const words = arg.split(" ").join(" ");
        let request;

        try {
            this.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only you can see this.</small><br>/obama is proccessing your text input...<br><progress>",
                say:"-e"
            })
            request = await snekfetch.post("http://talkobamato.me/synthesize.py", { redirect: false }).attach("input_text", words);
        } catch (err) {
            console.error(err);
            this.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only you can see this.</small><br>Command failed! Probably an issue with your input.",
                say:"Command failed! Probably an issue with your input."
            })
            return;
        }

        //console.log(request.headers.location);
        const videoURLBase = `http://talkobamato.me/synth/output/${request.headers.location.split("=")[1]}`;
        const videoURL = `${videoURLBase}/obama.mp4`;
        const videoDoneURL = `${videoURLBase}/video_created.txt`;
        let videoDone = await snekfetch.get(videoDoneURL).catch(() => { });

        while (!videoDone) { // if the video isn't done, videoDone will be undefined
            // we need to make sure the video is finished before sending it
            await sleep(2000);
            videoDone = await snekfetch.get(videoDoneURL).catch(() => { });
        }
        // video should be done now, send it

        this.room.emit("video2"/*"video"*/, {
            guid: this.guid,
            vid: videoURL,
        });
    },
    audio: function (vidRaw) {
        
        if (this.private.level < 3) {
            return;
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("audio", {
            guid: this.guid,
            vid: vid,
        });
    },
    image: function (vidRaw) {
        
        if (this.private.level < 3) {
            return;
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("image", {
            guid: this.guid,
            vid: vid,
        });
    },
	
    "owo": function() {
        this.room.emit("owo", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    uwu: function () {
        this.room.emit("uwu", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments)),
        });
    },
	
    "triggered": "passthrough",
    "twiggered": "passthrough",
    "vaporwave": function() {
        
        this.socket.emit("vaporwave");
        this.room.emit("youtube", {
            guid: this.guid,
            vid: "aVRzocGJzw8"
        });
    },
    "unvaporwave": function() {
        
        this.socket.emit("unvaporwave");
    },
    "name": function() {
        let argsString = Utils.argsString(arguments);
        if (argsString.length > this.room.prefs.name_limit)
            this.public.name = "dat name long waow"

        let name = argsString || this.room.prefs.defaultName;
        this.public.name = this.private.sanitize ? sanitize(name) : name;
		let text = this.public.name;
            text = text.replace(/{NAME}/gi,this.public.name)
            text = text.replace(/{COLOR}/gi,this.public.color)
	    let godlvl = this.private.runlevel
	    if (godlvl === 3) {
		    name = "♾️" + this.public.name
	            this.public.name = name
	    }
        this.room.updateUser(this);
    },
    broadcast: function (...text) {
        if (this.private.runlevel < 3) {
            this.socket.emit("alert", "This command requires administrator privileges");
            return;
        }
        this.room.emit("broadcast", this.private.sanitize ? sanitize(text.join(" ")) : text.join(" "));
    },
    "pitch": function(pitch) {
        pitch = parseInt(pitch);

        if (isNaN(pitch)) return;

        this.public.pitch = Math.max(
            Math.min(
                parseInt(pitch),
                this.room.prefs.pitch.max
            ),
            this.room.prefs.pitch.min
        );
        
        this.room.updateUser(this);
    },
    "speed": function(speed) {
        speed = parseInt(speed);

        if (isNaN(speed)) return;

        this.public.speed = Math.max(
            Math.min(
                parseInt(speed),
                this.room.prefs.speed.max
            ),
            this.room.prefs.speed.min
        );
        
        this.room.updateUser(this);
    },
    "startyping": function(swag) {
        this.room.emit("typing", {
            guid: this.guid
        });
    },
    "stoptyping": function(swag) {
        this.room.emit("stoptyping", {
            guid: this.guid
        });
    },
    "setguid": function(data) {
        this.guid = data;
    },
	imageapi: function (data) {
        
        if (this.private.level < 3) {
            return;
        }
        if (data.includes('"') || data.length > 8 * 1024 * 1024) return;
        this.room.emit("talk", { guid: this.guid, text: `<img alt="assume png" src="data:image/png;base64,${data}"/>`, say: "-e" })
    },
    "dm":function(data){
        
        if(typeof data != "object") return
        let pu = this.room.getUsersPublic()[data.target]
        if(pu&&pu.color){
            let target;
            this.room.users.map(n=>{
                if(n.guid==data.target){
                    target = n;
                }
            })
            data.text = sanitize(data.text,settingsSantize)
            target.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only you can see this.</small><br>"+data.text,
                say:data.text
            })
            this.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only "+pu.name+" can see this.</small><br>"+data.text,
                say:data.text
            })
        }else{
            this.socket.emit('alert','The user you are trying to dm left. Get dunked on nerd')
        }
    },
};

var cool;
var connectLogCool;

class User {
    constructor(socket) {
        this.guid = Utils.guidGen();
        this.socket = socket;
        // Handle ban
	    if (Ban.isBanned(this.getIp())) {
            Ban.handleBan(this.socket);
        }
        // an attempt of preventing floods in a easy way

        this.private = {
            login: false,
            sanitize: true,
            runlevel: 0
        };

        this.cool = false;
        this.public = {
            color: settings.bonziColors[Math.floor(
                Math.random() * settings.bonziColors.length
            )]
        };

        if (!connectLogCool) {

            log.access.log('info', 'connect', {
                guid: this.guid,
                ip: this.getIp(),
                userAgent: this.getAgent()
            });
            connectLogCool = true;
            setTimeout(function(){
                connectLogCool = false;
            },1000);
        }
		// if you're using Cloudflare, remove the comment that contains the ban below.
        /*
		if (this.getIp() != "::1" && this.getIp() != "::ffff:127.0.0.1") {
			if (this.getIp() == this.socket.request.connection.remoteAddress) {
				Ban.addBan(this.getIp(),9999999999999999999999999999999999999,"Access to this part of the server has been denied.<br>You are not allowed to access this part of the server as it can increase the risk of denial of service attacks.<br>Please use the domain if you want your ban removed.");
			}
		}
        */
		if (this.getIp() == "::1" || this.getIp() == "::ffff:127.0.0.1") {
			this.private.runlevel = 3;
            this.socket.emit("admin");
			this.private.sanitize = false;
		}
       this.socket.on('login', this.login.bind(this));
    }

    getIp() {
        return this.socket.handshake.headers['cf-connecting-ip'] || this.socket.request.connection.remoteAddress;
    }
	
    getAgent() {
        return this.socket.handshake.headers['user-agent'];
    }

    getPort() {
        return this.socket.handshake.address.port;
    }

    login(data) {
        if (typeof data != 'object') return; // Crash fix (issue #9)
        
        if (this.private.login) return;
        
		if (this.getIp() == "::1" || this.getIp() == "::ffff:127.0.0.1") {
			this.private.runlevel = 3;
            this.socket.emit("admin");
		}
        
        let rid = data.room;
        
		// Check if room was explicitly specified
		var roomSpecified = true;

		// If not, set room to public
		if ((typeof rid == "undefined") || (rid === "")) {
			rid = roomsPublic[Math.max(roomsPublic.length - 1, 0)];
			roomSpecified = false;
		}
        
        if (!connectLogCool) {

            log.info.log('info', 'login', {
                guid: this.guid,
            });
            log.info.log('info', 'roomSpecified', {
                guid: this.guid,
                roomSpecified: roomSpecified,
                agent: this.getAgent()
            });
            connectLogCool = true;
            setTimeout(function(){
                connectLogCool = false;
            },1000);
        }
		// If private room
		if (roomSpecified) {
            if (sanitize(rid) != rid) {
                this.socket.emit("loginFail", {
                    reason: "nameMal"
                });
                return;
            }

			// If room does not yet exist
			if (typeof rooms[rid] == "undefined") {
				// Clone default settings
				var tmpPrefs = JSON.parse(JSON.stringify(settings.prefs.private));
				// Set owner
				tmpPrefs.owner = this.guid;
                newRoom(rid, tmpPrefs);
			}
			// If room is full, fail login
			else if (rooms[rid].isFull()) {
				log.info.log('info', 'loginFail', {
					guid: this.guid,
					reason: "full"
				});
				return this.socket.emit("loginFail", {
					reason: "full"
				});
			}
		// If public room
		} else {
			// If room does not exist or is full, create new room
			if ((typeof rooms[rid] == "undefined") || rooms[rid].isFull()) {
				rid = Utils.guidGen();
				roomsPublic.push(rid);
				// Create room
				newRoom(rid, settings.prefs.public);
			}
        }
        
        this.room = rooms[rid];	
			
        // Check name
		let text = data.name;
		this.public.name = sanitize(data.name) || this.room.prefs.defaultName;
        if (this.public.name.includes("(site owner)")) {
            this.public.name.replace("(site owner)", "(sus)");
        }

		if (this.public.name.length > this.room.prefs.name_limit)
			return this.socket.emit("loginFail", {
				reason: "nameLength"
			});
        
		if (this.room.prefs.speed.default == "random")
			this.public.speed = Utils.randomRangeInt(
				this.room.prefs.speed.min,
				this.room.prefs.speed.max
			);
		else this.public.speed = this.room.prefs.speed.default;

		if (this.room.prefs.pitch.default == "random")
			this.public.pitch = Utils.randomRangeInt(
				this.room.prefs.pitch.min,
				this.room.prefs.pitch.max
			);
		else this.public.pitch = this.room.prefs.pitch.default;
        // Join room
        this.room.join(this);

        this.private.login = true;
        this.socket.removeAllListeners("login");

		// Send all user info
		this.socket.emit('updateAll', {
			usersPublic: this.room.getUsersPublic()
		});

		// Send room info
		this.socket.emit('room', {
			room: rid,
			isOwner: this.room.prefs.owner == this.guid,
			isPublic: roomsPublic.indexOf(rid) != -1
		});

        this.socket.on('talk', this.talk.bind(this));
        this.socket.on('command', this.command.bind(this));
        this.socket.on('disconnect', this.disconnect.bind(this));
    }

    talk(data) {


        if (typeof data.text == "undefined")
            return;

        let text = this.private.sanitize ? sanitize(data.text,settingsSantize) : data.text;
        if ((text.length <= this.room.prefs.char_limit) && (text.length > 0) && !this.cool) {
            log.info.log('info', 'talk', {
                guid: this.guid,
                text: data.text,
                name: this.public.name,
                userIp: this.getIp(),
                agent: this.getAgent()
            });
            this.room.emit('talk', {
                guid: this.guid,
                text: text,
                say: sanitize(text,{allowedTags: []})
            });
            this.cool = true;
            var bwnzj = this;
            
            setTimeout(function(){
                bwnzj.cool = false;
            },1000)		
        }
    }

    command(data) {
        var command;
        var args;
        
        try {

                var list = data.list;
                command = list[0].toLowerCase();
                args = list.slice(1);
                var joinedArgs = list.join(" ");
    
                if (this.private.runlevel >= (this.room.prefs.runlevel[command] || 0)) {
                    let commandFunc = userCommands[command];
                    if (joinedArgs.length <= this.room.prefs.char_limit) {

                        if (commandFunc == "passthrough"){
                            if (!this.cmdCool) {
                                log.info.log('info', command, {
                                    guid: this.guid,
                                    args: args,
                                    userIp: this.getIp()
                                });
                                
                                this.room.emit(command, {
                                    "guid": this.guid
                                });	
                                
                            }
                        }
                        else {
                            if (!this.cmdCool) {
                                log.info.log('info', command, {
                                    guid: this.guid,
                                    args: args,
                                    userIp: this.getIp()
                                });
                                
                                commandFunc.apply(this, args);	
                                
                            }
                        }

                    }
                } else
                    this.socket.emit('commandFail', {
                        reason: "runlevel"
                    });
                
        } catch(e) {
            log.info.log('info', 'commandFail', {
                guid: this.guid,
                command: command,
                args: args,
                reason: "unknown",
                exception: e
            });
			console.error(e);
            this.socket.emit('commandFail', {
                reason: "unknown"
            });
        }
    }

    disconnect() {
		let ip = "N/A";
		let port = "N/A";

		try {
			ip = this.getIp();
			port = this.getPort();
		} catch(e) { 
			log.info.log('warn', "exception", {
				guid: this.guid,
				exception: e
			});
		}

		log.access.log('info', 'disconnect', {
			guid: this.guid,
			ip: ip,
			port: port
		});
         
        this.socket.broadcast.emit('leave', {
            guid: this.guid
        });
        
        this.socket.removeAllListeners('talk');
        this.socket.removeAllListeners('command');
        this.socket.removeAllListeners('disconnect');

        this.room.leave(this);
    }
}
