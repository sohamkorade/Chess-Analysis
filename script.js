var thepgn = `[Event "Rated Bullet game"]
[Site "https://lichess.org/stc1FR7C"]
[Date "2023.06.01"]
[White "MrAnd3rs0n"]
[Black "sohamkorade"]
[Result "1-0"]
[UTCDate "2023.06.01"]
[UTCTime "16:26:46"]
[WhiteElo "1580"]
[BlackElo "1542"]
[WhiteRatingDiff "+5"]
[BlackRatingDiff "-11"]
[Variant "Standard"]
[TimeControl "120+1"]
[ECO "A40"]
[Opening "Queen's Pawn Game"]
[Termination "Normal"]
[Annotator "lichess.org"]

1. d4 { A40 Queen's Pawn Game } c6 2. Nf3 d5 3. Bf4 Bf5 4. e3 e6 5. Bd3 Bg6 6. Ne5 Nd7 7. Nxg6 hxg6 8. Nd2 Ndf6 9. Nf3 Bd6 10. Ne5 Ne4 11. f3 Bxe5 12. dxe5 Nc5 13. Be2 Ne7 14. Qd4 Qb6 15. e4 O-O-O 16. Be3 Nd7 17. Qc3 Rh7 18. Bxb6 Nxb6 19. O-O-O g5 20. exd5 Nexd5 21. Qc5 Nf4 22. Rxd8+ Kxd8 23. Qf8+ Kc7 24. Qxf7+ Nd7 25. Bd3 Nxd3+ 26. cxd3 Rh8 27. Qxg7 Rd8 28. Rd1 Kb6 29. Qxg5 Nc5 30. Qxd8+ Ka6 { Black resigns. } 1-0`

//==================================================
var game;
var board;
var dirty = false;

/// We can load Stockfish via Web Workers or via STOCKFISH() if loaded from a <script> tag.
var engine = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker('stockfish.js');
var engineStatus = {
    score: 0,
    mate: false,
    loaded: false,
    ready: false,
    search: null,
    running: false
};
let evalHistory = []

let optionPlayEngine = false
let optionOverwrite = false
let optionEvaluation = false
let defaultFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
let startFEN = defaultFEN
let thinkingTime = 3000
var $board = $('#board')
var squareClass = 'square-55d63'
var overlayEl;

function uciCmd(cmd) {
    // console.log("UCI: " + cmd);
    engine.postMessage(cmd);
}

function displayStatus() {
    var status = 'Engine: ';
    if (!engineStatus.loaded) {
        status += 'loading...';
    } else if (!engineStatus.ready) {
        status += 'loaded...';
    } else {
        status += 'ready.';
    }
    let score = engineStatus.score
    if (engineStatus.search) {
        status += engineStatus.search;
        if (score) {
            status += (score.substr(0, 4) === "Mate" ? " " : ' Score: ') + score;
        }
    }
    // $('#engineStatus').text(status);
    if (optionPlayEngine) score = 0
    if (score != undefined) {
        if (score[0] == "#") {
            $("#eval").text(score)
        } else if (score[0] == '<' || score[0] == '>') {
            $("#eval").text(score)
            score = score.substr(3)
        } else {
            let sign = score > 0 ? "+" : "-"
            $("#eval").text(sign + Math.abs(score))
        }
        let bar = calc_bar(score) + 50
        $("#evalbarW").height(bar + "%")
        $("#evalbarB").height(100 - bar + "%")
    }
}

function get_moves() {
    var moves = '';
    var history = game.history({ verbose: true });

    for (var i = 0; i < history.length; ++i) {
        var move = history[i];
        moves += ' ' + move.from + move.to + (move.promotion ? move.promotion : '');
    }

    return moves;
}

function runEngine() {
    clearAnnotation()
    uciCmd('stop')
    if (currEnginePly) return
    if (optionEvaluation || optionPlayEngine) {
        uciCmd('position startpos moves' + get_moves());
        // uciCmd("go infinite");
        currEnginePly = currPly;
        console.log("evaluating for", currEnginePly)
        evalHistory[currEnginePly] = 0
        uciCmd("go movetime " + thinkingTime);
        engineStatus.running = true;
    }
}

function update_game_result() {
    game.header().Result = game.in_checkmate() ? (game.turn() == 'w' ? "0-1" : "1-0") : (game.in_draw() ? "1/2-1/2" : "*")
}

function newMoveToHistory(move) {
    if (!game.move(move)) return false
    board.position(game.fen())
    gameHistory = game.history({ verbose: true })
    currPly++
    update_game_result()
    writeGameText()
    HighlightMove(move)
}

engine.onmessage = function (event) {
    var line = event
    if (event && typeof event === "object") {
        line = event.data;
    }
    // console.log("Reply: " + line)
    engineStatus.score = null;
    if (line == 'uciok') {
        engineStatus.loaded = true;
    } else if (line == 'readyok') {
        engineStatus.ready = true;
    } else {
        var moved = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        /// Did the AI move?
        if (moved) {
            currEnginePly = null
            if (optionPlayEngine) {
                newMoveToHistory({ from: moved[1], to: moved[2], promotion: moved[3] })
            }
        }
        var match = line.match(/(?<=pv )([a-h][1-8])([a-h][1-8])([qrbn])?/);
        /// Is the AI thinking?
        if (match) {
            engineStatus.running = false;
            if (line.match(/(?<=depth )-?\d+/) >= 10) {
                ArrowMove({ from: match[1], to: match[2], promotion: match[3] }, evalres)
            } else {
                clearAnnotation()
            }

            /// Is it sending feedback?
        } else if (match = line.match(/^info .*\bdepth (\d+) .*\bnps (\d+)/)) {
            engineStatus.search = 'Depth: ' + match[1] + ' Nps: ' + match[2];
        }

        /// Is it sending feed back with a score?
        if (match = line.match(/^info .*\bscore (\w+) (-?\d+)/)) {
            var score = parseInt(match[2]) * (game.turn() == 'w' ? 1 : -1);
            /// Is it measuring in centipawns?
            if (match[1] == 'cp') {
                engineStatus.score = (score / 100.0).toFixed(2);
                evalres = engineStatus.score
                evaltype = "cp"
                /// Did it find a mate?
            } else if (match[1] == 'mate') {
                engineStatus.score = '#' + Math.abs(score);
                evalres = 10 * (game.turn() == 'w' ? 1 : -1)
                evaltype = "mate"
            }

            /// Is the score bounded?
            if (match = line.match(/\b(upper|lower)bound\b/)) {
                engineStatus.score = ((match[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineStatus.score
            }
        }
        if (!optionPlayEngine && currEnginePly != null && engineStatus.score) {
            while (evalHistory.length <= currEnginePly) evalHistory.push(0)
            evalHistory[currEnginePly] = engineStatus.score
            $("#gameEval" + currEnginePly).text(engineStatus.score)
            if (currEnginePly > 0 && evalHistory[currEnginePly - 1] != 0) {
                // $("#gameMove" + currentPly).css("background-color", "rgba(255, 0, 0, " + Math.abs(evalHistory[currentPly] - evalHistory[currentPly - 1]) / 10 + ")")
                addPlyFeedback(currEnginePly, get_feedback(evalHistory[currEnginePly - 1], evalHistory[currEnginePly]))
            }
            // drawChart(evalHistory)
            console.log("evaluated for", currEnginePly, ":", engineStatus.score)
        }
    }
    displayStatus();
};

function calc_bar(x) {
    if (evaltype == "mate") return 50
    if (x === 0) {
        return 0;
    } else if (x < 7) {
        return -(0.322495 * Math.pow(x, 2)) + 7.26599 * x + 4.11834;
    } else {
        return (8 * x) / 145 + 5881 / 145;
    }
};

function ArrowMove(move, eval) {
    addArrowAnnotation(move.from, move.to, false, eval)
}

function HighlightMove(move, eval) {
    $board.find('.square-55d63').removeClass('highlight-white')
    if (move) {
        $board.find('.square-' + move.from).addClass('highlight-white')
        $board.find('.square-' + move.to).addClass('highlight-white')
    }
}

function addSqFeedback(square, type) {
    $board.find('.square-55d63').css('background-image', '')
    $board.find('.square-' + square).css('background-image', `url('move_feedbacks/${type}.svg')`)
}
function addPlyFeedback(ply, type) {
    if (type == "") return
    $('#gameMove' + ply).css('background-image', `url('move_feedbacks/${type}.svg')`)
}

var cfg = {
    showErrors: true,
    draggable: true,
    position: 'start',
    onDragStart: function (source, piece, position, orientation) {
        var re = game.turn() == 'w' ? /^b/ : /^w/
        // do not pick up pieces if the game is over
        // only pick up pieces for current player
        clearAnnotation()
        if (piece.search(re) !== -1) return false;
        return !game.game_over()
    },
    onDrop: function (source, target) {
        if (wasmouserightbuttondown) {
            addArrowAnnotation(source, target)
            wasmouserightbuttondown = false
        } else {
            // see if the move is legal
            let promotion = 'q'
            if (game.get(source).type == "p")
                if (target[1] == "8" || target[1] == "1")
                    promotion = prompt("Promotion? (q, r, b, n)")
            var move = game.move({
                from: source,
                to: target,
                promotion: promotion
            });
            // illegal move
            if (move === null) {
                return 'snapback';
            }
            currPly++
            HighlightMove(move)
            if (optionOverwrite) {
                gameHistory = game.history({ verbose: true })
                update_game_result()
                writeGameText()
            } else {
                dirty = true;
            }
            runEngine();
        }
    },
    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    onSnapEnd: function () {
        board.position(game.fen());
    },
    onChange: function () { //fires when the board position changes
        //highlight the current move
        if (!dirty) {
            $("[id^='gameMove']").removeClass('highlight');
            $('#gameMove' + currPly).addClass('highlight');
        }
        clearAnnotation()
    },
    // onMouseoverSquare: onMouseoverSquare,
    onMouseoutSquare: function (source, piece, position, orientation) {
        if (mouserightbuttondown) {
            if (beginarrow == "") {
                beginarrow = source
                // console.log("begin:", beginarrow)
            }
        } else if (beginarrow != "") {
            // console.log("end:", source)
            addArrowAnnotation(beginarrow, source)
            beginarrow = ""
        }
    }
};
//PGN VIEWER-------------------------------------------------------------------


//Write the game to the DOM
function writeGameText2(g) {

    //remove the header to get the moves
    var h = g.header();
    var gameHeaderText = '<b>' + h.White + ' (' + h.WhiteElo + ') - ' + h.Black + ' (' + h.BlackElo + ')</b>';
    gameHeaderText += '<br><i>' + h.Event + ', ' + h.Site + ' ' + h.EventDate + '</i>';
    var pgn = g.pgn();
    var gameMoves = pgn.replace(/\[(.*?)\]/gm, '').replace(h.Result, '').trim();

    //format the moves so each one is individually identified, so it can be highlighted
    moveArray = gameMoves.split(/([0-9]+\.\s)/).filter(n => n);
    for (var i = 0, l = moveArray.length; i < l; ++i) {
        var s = $.trim(moveArray[i]);
        if (!/^[0-9]+\.$/.test(s)) { //move numbers
            m = s.match(/{.*}|\w+/g)
            for (var j = 0, ll = m.length; j < ll; ++j) {
                if (/^{.*}$/.test(m[j])) {
                    m[j] = '<span class="gameAnno" onclick="mov(' + (i + j - 2) + ')">' + m[j] + '</span>';
                } else {
                    m[j] = '<span id="gameMove' + (i + j - 1) + '" onclick="mov(' + (i + j - 1) + ')">' + m[j] + '</span>';
                }
            }
            s = m.join(' ');
        }
        moveArray[i] = s;
    }
    $("#game-data").html(gameHeaderText + '<div class="gameMoves">' + moveArray.join(' ') + ' <span class="gameResult">' + h.Result + '</span></div>');

}

function writeGameText() {
    let h = game.header()
    let history = game.history({ verbose: true })
    let moves = ""
    let html = ""
    html += `<pre>${JSON.stringify(h, null, 2)}</pre>`
    // make a table of moves
    // add a blank move if black to move
    let i = 0
    if (history.length && history[0].color == 'b')
        i = -1
    for (; i < history.length; i += 2) {
        let w = '', b = ''
        if (i == -1)
            w = `<td id="gameMove${i}" onclick="mov(${i})">...<span id="gameEval${i}">${evalHistory[i] || '-'}</span></td>`
        else
            w = `<td id="gameMove${i}" onclick="mov(${i})">${history[i].san}<span id="gameEval${i}">${evalHistory[i] || '-'}</span></td>`
        if (i != history.length - 1)
            b = `<td id = "gameMove${i + 1}" onclick = "mov(${i + 1})"> ${history[i + 1].san}<span id="gameEval${i + 1}">${evalHistory[i + 1] || '-'}</span></td>`
        moves += `<tr><td>${Math.ceil(i / 2) + 1}</td>${w}${b}</tr>`
    }
    $("#game-history").html(moves)
    $("#game-result").html(`<div class="text-center">
                    <h2><b>${h.Result || ""}</b></h2>
                </div>`)
}


$(document).ready(function () {
    //buttons
    $('#btnStart').on('click', function () {
        mov(-1)
    });
    $('#btnPrevious').on('click', function () {
        mov(currPly - 1)
    });
    $('#btnNext').on('click', function () {
        mov(currPly + 1)
    });
    $('#btnEnd').on('click', function () {
        mov(gameHistory.length - 1)
    });
    $('#btnPaste').on('click', function () {
        navigator.clipboard.readText().then(e => {
            // console.log(e);
            // if (e.match(/(?=\s*)([rnbqkpRNBQKP1-8]+\/){7}([rnbqkpRNBQKP1-8]+)\s[bw-]\s(([a-hkqA-HKQ]{1,4})|(-))\s(([a-h][36])|(-))\s\d+\s\d+(?=\s*)/)) {
            if (game.validate_fen(e).valid) { // fen
                load_fen(e)
                $('#chkOverwrite').prop('checked', optionOverwrite = true)
            } else if (!load_pgn(e)) { // pgn
                alert("Invalid FEN/PGN")
            }
        })
    });

    $('#btnFlip').on('click', function () {
        board.flip()
        $("#evalbar").toggleClass("ulta")
        $(".overlay-4fc5e").toggleClass("ulta")
        displayStatus()
    });

    $('#btnCopyPGN').on('click', function () {
        navigator.clipboard.writeText(game.pgn()).then(function () {
            /* clipboard successfully set */
        }, function () {
            /* clipboard write failed */
        });
    });

    $('#btnCopyFEN').on('click', function () {
        navigator.clipboard.writeText(game.fen()).then(function () {
            /* clipboard successfully set */
        }, function () {
            /* clipboard write failed */
        });
    });

    $('#btnAnalyze').on('click', function () {
        Analyse(null, thinkingTime)
    });

    $('#btnNewGame').on('click', function () {
        game.reset()
        mov(-1)
        evalHistory = []
        gameHistory = []
        update_game_result()
        writeGameText()
        $('#chkOverwrite').prop('checked', optionOverwrite = true)
    });

    $('#chkEngine').on('change', function () {
        if (this.checked) {
            optionEvaluation = true
            runEngine()
        } else {
            optionEvaluation = false
            clearAnnotation()
        }
    });

    $('#chkOverwrite').on('change', function () {
        optionOverwrite = this.checked
    });

    $('#chkPlayEngine').on('change', function () {
        optionPlayEngine = this.checked
        if (this.checked) {
            $('#chkOverwrite').prop('checked', optionOverwrite = true)
            runEngine()
        }
        $('#chkEngine').prop('disabled', this.checked)
        $('#chkOverwrite').prop('disabled', this.checked)
    });

    $('#thinkTime').on('change', function () {
        thinkingTime = parseInt(this.value) * 1000
    });

    //key bindings
    $(document).keydown(function (e) {
        if (e.key == 'ArrowLeft' && e.ctrlKey) $('#btnStart').click()
        else if (e.key == 'ArrowRight' && e.ctrlKey) $('#btnEnd').click()
        else if (e.key == 'ArrowLeft') $('#btnPrevious').click()
        else if (e.key == 'ArrowRight') $('#btnNext').click()
        else if (e.key == "f") $('#btnFlip').click()
        else if (e.key == "e") $('#chkEngine').click()
        else if (e.key == 'Home') $('#btnStart').click()
        else if (e.key == 'End') $('#btnEnd').click()
        else if (e.key == 'ArrowUp') mov(currPly - 2)
        else if (e.key == 'ArrowDown') mov(currPly + 2)
        return false
    });

    $(document).mousedown(function (e) {
        mouseleftbuttondown = (e.button == 0)
        mousewheelbuttondown = (e.button == 1)
        mouserightbuttondown = (e.button == 2)
        wasmousewheelbuttondown = (e.button == 1)
        wasmouserightbuttondown = (e.button == 2)
        if (e.button == 0) {
            mouseleftbuttondown = false
            mousewheelbuttondown = false
            mouserightbuttondown = false
            wasmouserightbuttondown = false
            wasmousewheelbuttondown = false
        }
    });

    $(document).mouseup(function (e) {
        mousewheelbuttondown = false
        mouserightbuttondown = false
        mouseleftbuttondown = false
    });

    mainfunction();
});
var mouseleftbuttondown = false
var mouserightbuttondown = false
var mousewheelbuttondown = false
var wasmouserightbuttondown = false
var wasmousewheelbuttondown = false
var beginarrow = ""
var arrowannotations = {}

var currPly = -1;
let currEnginePly = null

// used for clickable moves
function mov(ply) {
    // console.log("mov", ply)
    if (currPly != ply) {
        ply = Math.min(ply, gameHistory.length - 1)
        ply = Math.max(ply, -1)
        if (dirty || ply == -1) {
            while (currPly >= 0) {
                game.undo()
                currPly--
            }
            game.load(startFEN)
            dirty = false;
        }
        while (currPly > ply) {
            game.undo()
            currPly--
        }
        while (currPly < ply) {
            currPly++
            game.move(gameHistory[currPly].san)
        }
        HighlightMove(gameHistory[currPly])
        board.position(game.fen());
    }
    displayStatus()
    if (optionEvaluation) runEngine()
}

function load_pgn(pgntext) {
    // console.log("PGN: " + pgntext)
    startFEN = defaultFEN
    if (!game.load_pgn(pgntext)) {
        return false
    }
    // board.position(game.fen())
    gameHistory = game.history({ verbose: true })
    evalHistory = Array(gameHistory.length).fill(0)
    writeGameText()
    currPly = gameHistory.length - 1
    $('#btnStart').click()
}

function load_fen(fen) {
    startFEN = fen
    mov(-1)
    update_game_result()
    writeGameText()
    $("#game-data").text("From FEN")
    gameHistory = []
    evalHistory = []
}

function computePath(s1, s2) {
    var COLUMNS = 'abcdefgh'.split('')
    var SQ_SIZE = $(".square-a1").css("width").replace("px", "")

    function tristate(a, b) {
        if (a < b) return -0.25;
        if (a > b) return +0.25;
        return 0;
    }

    var start = { x: COLUMNS.indexOf(s1[0]), y: parseInt(s1[1], 10) - 1 };
    var end = { x: COLUMNS.indexOf(s2[0]), y: parseInt(s2[1], 10) - 1 };

    if (cfg.orientation == "white") {
        start.y = 7 - start.y;
        end.y = 7 - end.y;
    }

    var dist = { x: Math.abs(start.x - end.x), y: Math.abs(start.y - end.y) };
    var corner; // Point of the dog-leg for knight moves
    var epsilon; // To adjust the target coords to take account of the arrowhead.

    if (dist.x != 0 && dist.y != 0 && dist.x != dist.y) {
        // Knight move; Calculate a corner point for the path, such that
        // the path dog-legs first along the long side, then short.
        if (dist.x > dist.y) {
            corner = { x: end.x, y: start.y };
            epsilon = { x: 0, y: tristate(start.y, end.y) };
        } else {
            corner = { x: start.x, y: end.y };
            epsilon = { x: tristate(start.x, end.x), y: 0 };
        }
    } else {
        epsilon = { x: tristate(start.x, end.x), y: tristate(start.y, end.y) };
    }

    var path = ["M", SQ_SIZE * (start.x + 0.5), SQ_SIZE * (start.y + 0.5)];
    if (corner !== undefined) {
        path.push("L", SQ_SIZE * (corner.x + 0.5), SQ_SIZE * (corner.y + 0.5));
    }
    path.push("L", SQ_SIZE * (end.x + epsilon.x + 0.5), SQ_SIZE * (end.y + epsilon.y + 0.5));

    return path.join(" ");
}

function createSvgEl(tag, attr) {
    // jQuery seemingly can't handle namespaces or case-sensitive attributes,
    // so we have to go old-skool.
    var svgEl = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var key in attr) {
        svgEl.setAttribute(key, attr[key]);
    }
    return $(svgEl);
}

function buildOverlay() {
    var defsEl = createSvgEl("defs", {});
    defsEl.append(
        createSvgEl("marker", {
            id: "arrowhead",
            viewBox: "0 0 10 10",
            refX: "0",
            refY: "5",
            markerUnits: "strokeWidth",
            markerWidth: "3",
            markerHeight: "2",
            orient: "auto"
        }).append(
            createSvgEl("path", {
                d: "M 0 0 L 5 5 L 0 10 Z"
            })
        ),
        createSvgEl("marker", {
            id: "bulb",
            viewBox: "0 0 10 10",
            refX: "5",
            refY: "5",
            markerUnits: "strokeWidth",
            markerWidth: "3",
            markerHeight: "2",
            orient: "auto"
        })
        // .append(
        //     createSvgEl("circle", {
        //         cx: 5,
        //         cy: 5,
        //         r: 4
        //     })
        // )
    );
    overlayEl.empty();
    overlayEl.append(defsEl);
}

function addArrowAnnotation(source, target, nodouble = true, eval) {
    if (arrowannotations[source] == target) {
        delete arrowannotations[source]
        if (nodouble) {
            removeArrowAnnotation(source, target)
            return
        }
    }

    arrowannotations[source] = target
    var SQ_SIZE = $(".square-a1").css("width").replace("px", "")
    var groupEl = overlayEl.find('> .square-' + source);
    if (!groupEl.length) {
        groupEl = createSvgEl("g", {
            'class': "overlay-group-672a1 square-" + source
        });
        overlayEl.append(groupEl);
    }

    $(groupEl).css("opacity", Math.abs(eval / 100) + 0.5)

    var pathEl = overlayEl.find("> g.square-" + source + " > path.square-" + target);
    if (!pathEl.length) {
        var pathEl = createSvgEl("path", {
            'class': "overlay-arrow-9d6ed square-" + target,
            'd': computePath(source, target),
            'stroke-width': (SQ_SIZE / 4)
        });
        groupEl.append(pathEl);
    }
}

var removeArrowAnnotation = function (source, target) {
    overlayEl.find(
        '> g.square-' + source +
        (target !== undefined ? ' > path.square-' + target : '')
    ).remove();
}

var clearAnnotation = function () {
    arrowannotations = {}
    buildOverlay();
}

function buildOverlayElement() {
    var SQ_SIZE = $(".square-55d63.black-3c85d.square-a1").css("width").replace("px", "")
    $(".board-b72b1").before('<svg class="overlay-4fc5e"></svg>')
    overlayEl = $(".overlay-4fc5e")
    buildOverlay();

    overlayEl.css('width', (SQ_SIZE * 8) + 'px');
    overlayEl.css('height', (SQ_SIZE * 8) + 'px');
    overlayEl.css('padding', $(".board-b72b1").css("border-top-width"));

}

function mainfunction() {
    board = new ChessBoard('board', cfg);
    window.onresize = function () { board.resize() }
    const prevent = function (e) { e.preventDefault(); return false }
    $board.on('contextmenu', prevent)
    $('img').on('contextmenu', prevent)

    buildOverlayElement()

    game = new Chess();
    load_pgn(thepgn)
    uciCmd('uci');
    uciCmd('ucinewgame');
    uciCmd('isready');
    engineStatus.ready = false;
    engineStatus.search = null;
    displayStatus();
}

//analysis code
let evaltype = "cp"
var evalres = 0
var preevalres = 0
var analysislog = { move: [], anno: [], color: [], eval: [] }

function Analyse(pgn = null, time = 2000) {
    analysislog = { move: [], anno: [], color: [], eval: [] }
    if (pgn == null) { pgn = get_moves().trim().split(" ") }
    // pgn = pgn.trim().split(" ")
    uciCmd("ucinewgame")
    evalres = -1
    movebymoveanalyse(pgn, time)

    // analysislog =
    //     { "move": [], "anno": [0, 20.07, 0.7, 0.3, 0.73, 1.55, 1.23, 1.17, 1.3699999999999999, 0.96, 0.56, 0.8400000000000001, 0.8899999999999999, 0.6699999999999999, 0.8600000000000001, 0.74, 0, -0.22000000000000003, -0.35000000000000003, -0.57, -0.52, -0.30000000000000004, -0.16000000000000003, -0.2, -0.62, -0.64, -0.13, -0.5900000000000001, -0.74, -0.15000000000000002, 0.38999999999999996, 0.94, 1.13, 1.44, 1.12, 0.5800000000000001, 0.47, 0.9, 1.1, 0.74, 1.8699999999999999, 2.17, 1.95, 2.19, 1.46, 1.26, 1.26, 1.4100000000000001, 1.42, 1.35, 1.01, -0.52, -1.84, -2.86, -3.76, -5.14, -5.1899999999999995, -4.300000000000001, -4.29, -4.08, -4.220000000000001, -4.55, -4.42, -4.95, -5.98, -7.1899999999999995, -7.1, -5.7, -5.68, -6.1, -6.26, -6.34, -6.51, -6.4, -6.4, -6.68, -6.68, -6.62, -6.66, -6.62, -6.73, -7.029999999999999, -7.39, -7.22, -7.029999999999999, -6.83, -6.68, -6.470000000000001, -6.41, -6.18, -5.9, -5.9, -5.95, -6.51, -6.15, -5.630000000000001, -2.99, -2.32, -0.19999999999999973, 5.65, 7.5, 7.95, 9.87], "color": ["black", "blue", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "black", "black", "black", "black", "black", "black", "black", "black", "black", "black", "black", "black", "black", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "black", "yellow", "yellow", "orange", "red", "red", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "yellow", "yellow", "black", "blue", "blue", "blue", "blue"], "eval": [0, 0.06, 0.64, -0.34, 1.07, 0.48, 0.75, 0.42, 0.95, 0.01, 0.55, 0.29, 0.6, 0.07, 0.79, -0.05, 0.05, -0.27, -0.08, -0.49, -0.03, -0.27, 0.11, -0.31, -0.31, -0.33, 0.2, -0.79, 0.05, -0.2, 0.59, 0.35, 0.78, 0.66, 0.46, 0.12, 0.35, 0.55, 0.55, 0.19, 1.68, 0.49, 1.46, 0.73, 0.73, 0.53, 0.73, 0.68, 0.74, 0.61, 0.4, -0.92, -0.92, -1.94, -1.82, -3.32, -1.87, -2.43, -1.86, -2.22, -2, -2.55, -1.87, -3.08, -2.9, -4.29, -2.81, -2.89, -2.79, -3.31, -2.95, -3.39, -3.12, -3.28, -3.12, -3.56, -3.12, -3.5, -3.16, -3.46, -3.27, -3.76, -3.63, -3.59, -3.44, -3.39, -3.29, -3.18, -3.23, -2.95, -2.95, -2.95, -3, -3.51, -2.64, -2.99, 0, -2.32, 2.12, 3.53, 3.97, 3.98, 5.89] }
    // drawChart(analysislog.eval)
}

function get_feedback(prev_eval, curr_eval) {
    let diff = curr_eval - prev_eval
    if (game.turn() == "w") diff = -diff
    if (diff <= -5) {
        return "blunder"
    } else if (diff <= -3) {
        return "mistake"
    } else if (diff <= -1) {
        return "inaccuracy"
    } else if (diff >= 5) {
        return "excellent"
    } else if (diff >= 3) {
        return "best"
    } else if (diff >= 0) {
        return "good"
    }
    return ""
}

function movebymoveanalyse(moves, time = 1000, count = 0) {
    if (evalres != -1) {
        let ply = count - 1
        let anno = ""
        let plycolor = "black"
        let diff = -(parseFloat(evalres) + parseFloat(preevalres))
        if (diff <= -5) {
            anno = "blunder"
            plycolor = "red"
        } else if (diff <= -3) {
            anno = "mistake"
            plycolor = "orange"
        } else if (diff <= -1) {
            anno = "inaccuracy"
            plycolor = "yellow"
        } else if (diff >= 5) {
            anno = "excellent"
            plycolor = "green"
        } else if (diff >= 3) {
            anno = "best"
            plycolor = "green"
        } else if (diff >= 0) {
            anno = "good"
            plycolor = "lightgreen"
        }
        if (plycolor != "black") $("#gameMove" + ply).css("color", plycolor)
        if (anno != "") $("#gameMove" + ply).css('background-image', `url('move_feedbacks/${anno}.svg')`)

        analysislog.color.push(plycolor)
        analysislog.anno.push(anno)

        preevalres = evalres
        if (evalres > 10) evalres = 10
        if (evalres < -10) evalres = -10
        analysislog.eval.push(-evalres)
    }
    if (count == moves.length) {
        // console.clear()
        console.log(analysislog)
        drawChart(analysislog.eval)
        return
    }
    evalres = -1
    mov(count)
    let startposmoves = moves.slice(0, count).join(" ").trim()
    if (startposmoves == "") {
        uciCmd(`position startpos`);
    } else {
        uciCmd(`position startpos moves ${startposmoves} `);
    }
    uciCmd(`go searchmoves ${moves[count]} movetime ${time - 100} `)
    setTimeout(movebymoveanalyse, time, moves, time, count + 1);
}

function drawChart(moveeval) {
    var chart = new Chart('myChart', {
        // The type of chart we want to create
        type: 'line',
        // The data for our dataset
        data: {
            labels: Array.from({ length: moveeval.length }, (x, i) => i + 1),
            datasets: [{
                data: moveeval,
            }]
        },

        // Configuration options go here
        options: {
            legend: { display: false },
            events: ['click'],
            onClick: function (c, i) {
                if (i[0] != undefined) mov(i[0]._index)
            }
        }
    });
}