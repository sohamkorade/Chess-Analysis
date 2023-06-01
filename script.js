var thepgn = `[Event "Rated Blitz game"]
[Site "https://lichess.org/HaUeZaAV"]
[Date "2020.08.21"]
[White "SohamKorade"]
[Black "gambithero"]
[Result "1/2-1/2"]
[UTCDate "2020.08.21"]
[UTCTime "16:17:22"]
[WhiteElo "1497"]
[BlackElo "1472"]
[WhiteRatingDiff "-1"]
[BlackRatingDiff "+1"]
[Variant "Standard"]
[TimeControl "180+2"]
[ECO "A45"]
[Opening "Indian Game"]
[Termination "Normal"]
[Annotator "lichess.org"]
    
1. d4 Nf6 { A45 Indian Game } 2. Bf4 d6?! { (-0.09 → 0.43) Inaccuracy. e6 was best. } (2... e6 3. c4 d5 4. e3 c5 5. Nc3 cxd4 6. exd4 Nc6 7. c5) 3. e3 c6 4. Nf3 g5?? { (0.01 → 2.33) Blunder. Nh5 was best. } (4... Nh5 5. Nbd2 Nd7 6. Bd3 Nxf4 7. exf4 g6 8. O-O Bg7 9. Re1) 5. Bxg5 Bg4 6. h3?? { (2.60 → -2.69) Blunder. Bxf6 was best. } (6. Bxf6 exf6 7. Nbd2 Nd7 8. a4 Rg8 9. Bd3 Be6 10. O-O Bh3 11. Ne1 Bg4 12. Qc1 d5) 6... Bxf3 7. Qxf3 Qa5+ 8. Nc3 Qxg5 9. Bd3 Rg8 10. Rg1 Nbd7 11. O-O-O O-O-O 12. Kb1 Kb8 13. Ne4 Nxe4 14. Bxe4 Nf6 15. Bxc6? { (-3.18 → -6.19) Mistake. Bd3 was best. } (15. Bd3 d5) 15... bxc6 16. Qxc6 Rc8 17. Qa6 Qd5 18. Rd3 Rc6 19. Rb3+ Rb6 20. Rxb6+ axb6 21. Qxb6+ Qb7?! { (-5.04 → -3.38) Inaccuracy. Kc8 was best. } (21... Kc8 22. g4 e6 23. Qa6+ Kd7 24. c4 Qe4+ 25. Ka1 Ke7 26. c5 dxc5 27. dxc5 Nd5 28. Rc1) 22. Qd8+ Ka7 23. Qa5+ Qa6 24. Qc7+ Qb7 25. Qa5+ Kb8 26. Qd8+ Qc8 27. Qb6+ Qb7?? { (-3.43 → 0.00) Blunder. Ka8 was best. } (27... Ka8 28. g4 Qb7 29. Qa5+ Qa7 30. Qb5 Qd7 31. Qa5+ Kb8 32. g5 Qc7 33. Qf5 h6 34. h4) 28. Qd8+ Qc8 29. Qb6+ Qb7?? { (-3.36 → 0.00) Blunder. Ka8 was best. } (29... Ka8 30. g4 Qb7 31. Qa5+ Qa7 32. Qb5 Qd7 33. Qa5+ Kb8 34. g5 Qc7 35. Qf5 Qb7 36. h4) 30. Qd8+ Qc8 { The game is a draw. } 1/2-1/2`

//==================================================
var pgnData = []

fetch("MagnusCarlsen.pgn").then(e => e.text()).then(e => {
    pgnData = e.split("\n\n\n").map(g => g.split("\n"))
        //load the first game
    loadGame(0);
})

var game;
var board;

/// We can load Stockfish via Web Workers or via STOCKFISH() if loaded from a <script> tag.
var engine = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker('stockfish.js');
var evaler = typeof STOCKFISH === "function" ? STOCKFISH() : new Worker('stockfish.js');
var engineStatus = {};
var displayScore = false;
var playerColor = 'white';
var isEngineRunning = false;
var evaluation_el;
var announced_game_over;
// do not pick up pieces if the game is over
// only pick up pieces for White
var onDragStart = function(source, piece, position, orientation) {
    // var re = playerColor == 'white' ? /^b/ : /^w/
    // if (game.game_over() ||
    //     piece.search(re) !== -1) {
    //     return false;
    // }
    // return !game.game_over()
};

function uciCmd(cmd, which) {
    console.log("UCI: " + cmd);

    (which || engine).postMessage(cmd);
}

function displayStatus() {
    var status = 'Engine: ';
    if (!engineStatus.engineLoaded) {
        status += 'loading...';
    } else if (!engineStatus.engineReady) {
        status += 'loaded...';
    } else {
        status += 'ready.';
    }

    if (engineStatus.search) {
        status += '<br>' + engineStatus.search;
        if (engineStatus.score && displayScore) {
            status += (engineStatus.score.substr(0, 4) === "Mate" ? " " : ' Score: ') + engineStatus.score;
        }
    }
    $('#engineStatus').html(status);
    $("#eval").text(engineStatus.score)
    if (engineStatus.score != undefined) {
        if (engineStatus.score > 0) {
            $("#eval1").val(engineStatus.score)
            $("#eval2").val(0)
        } else {
            $("#eval1").val(0)
            $("#eval2").val(-engineStatus.score)
        }
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

var optionShowMoveArrows = true

function prepareMove() {
    board.position(game.fen());
    clearAnnotation()
    var turn = game.turn() == 'w' ? 'white' : 'black';
    uciCmd('stop')
    uciCmd('stop', evaler)
    if (optionShowMoveArrows) {
        uciCmd('position startpos moves' + get_moves());
        uciCmd('position startpos moves' + get_moves(), evaler);
        evaluation_el.textContent = "";
        uciCmd("eval", evaler);

        // uciCmd("go infinite");
        uciCmd("go movetime 1000");
        isEngineRunning = true;
    }
}

evaler.onmessage = function(event) {
    var line;

    if (event && typeof event === "object") {
        line = event.data;
    } else {
        line = event;
    }

    // console.log("evaler: " + line);

    /// Ignore some output.
    if (line === "uciok" || line === "readyok" || line.substr(0, 11) === "option name") {
        return;
    }

    if (evaluation_el.textContent) {
        evaluation_el.textContent += "\n";
    }
    evaluation_el.textContent += line;
}

engine.onmessage = function(event) {
    var line;

    if (event && typeof event === "object") {
        line = event.data;
    } else {
        line = event;
    }
    console.log("Reply: " + line)
    if (line == 'uciok') {
        engineStatus.engineLoaded = true;
    } else if (line == 'readyok') {
        engineStatus.engineReady = true;
    } else {
        // var match = line.match(/^bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/);
        var match = line.match(/(?<=pv )([a-h][1-8])([a-h][1-8])([qrbn])?/);
        /// Did the AI move?
        if (match) {
            isEngineRunning = false;
            if (line.match(/(?<=depth )-?\d+/) >= 10) {
                HighlightMove({ from: match[1], to: match[2], promotion: match[3] }, evalres)
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
                    /// Did it find a mate?
            } else if (match[1] == 'mate') {
                engineStatus.score = 'Mate in ' + Math.abs(score);
                evalres = 10 * (game.turn() == 'w' ? 1 : -1)
            }

            /// Is the score bounded?
            if (match = line.match(/\b(upper|lower)bound\b/)) {
                engineStatus.score = ((match[1] == 'upper') == (game.turn() == 'w') ? '<= ' : '>= ') + engineStatus.score
            }
        }
    }
    displayStatus();
};

var onDrop = function(source, target) {
    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    // illegal move
    if (move === null) {
        return 'snapback';
        clearAnnotation()
    }
    prepareMove();
    if (wasmouserightbuttondown) {
        addArrowAnnotation(source, target)
        wasmouserightbuttondown = false
    }
};

var onMouseoutSquare = function(source, piece, position, orientation) {
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

//soham edits
var $board = $('#board')
var squareClass = 'square-55d63'

function HighlightMove(move = null, eval) {
    if (move == null) {
        var history = game.history({ verbose: true })
        var move = history[history.length - 1]
    }
    if (move != null) {
        addArrowAnnotation(move.from, move.to, false, eval)
            // if (move.color === 'w') {
            //     $board.find('.' + squareClass).removeClass('highlight-white')
            //     $board.find('.square-' + move.from).addClass('highlight-white')
            //     $board.find('.square-' + move.to).addClass('highlight-white')
            // } else {
            //     $board.find('.' + squareClass).removeClass('highlight-black')
            //     $board.find('.square-' + move.from).addClass('highlight-black')
            //     $board.find('.square-' + move.to).addClass('highlight-black')
            // }
    }
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
var onSnapEnd = function() {
    board.position(game.fen());
};

var cfg = {
    showErrors: true,
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    onChange: onChange,
    // onMouseoverSquare: onMouseoverSquare,
    onMouseoutSquare: onMouseoutSquare
};


function loadPgn(pgn) {
    game.load_pgn(pgn)
};

function setDisplayScore(flag) {
    displayScore = flag;
    displayStatus();
}

//PGN VIEWER-------------------------------------------------------------------


//Write the game to the DOM
function writeGameText(g) {

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


$(document).ready(function() {
    //buttons
    $('#btnStart').on('click', function() {
        game.reset();
        currentPly = -1;
        board.position(game.fen());
    });
    $('#btnPrevious').on('click', function() {
        if (currentPly >= 0) {
            game.undo();
            currentPly--;
            board.position(game.fen());
        }
    });
    $('#btnNext').on('click', function() {
        if (currentPly < gameHistory.length - 1) {
            currentPly++;
            game.move(gameHistory[currentPly].san);
            board.position(game.fen());
        }
    });
    $('#btnEnd').on('click', function() {
        while (currentPly < gameHistory.length - 1) {
            currentPly++;
            game.move(gameHistory[currentPly].san);
        }
        board.position(game.fen());
    });
    $('#btnPaste').on('click', function() {
        navigator.clipboard.readText().then(e => {
            // console.log(e);
            // if (e.match(/(?=\s*)([rnbqkpRNBQKP1-8]+\/){7}([rnbqkpRNBQKP1-8]+)\s[bw-]\s(([a-hkqA-HKQ]{1,4})|(-))\s(([a-h][36])|(-))\s\d+\s\d+(?=\s*)/)) {
            if (game.validate_fen(e).valid) {
                game.reset();
                game.load(e)
                board.position(game.fen());
                currentPly = -1;
                $("#game-data").html("From FEN")
                gameHistory = []
            } else {
                game.reset();
                PGNloader(e)
                currentPly = -1;
                board.position(game.fen());
            }
        })
    });

    $('#btnAnalyze').on('click', function() {
        let deftime = prompt("Maximum time for analysis per move in seconds", 1)
        if (deftime == null) return
        $("#btnEnd").click()
        deftime = parseFloat(deftime)
        if (deftime < 1) deftime = 1
        if (deftime != null) Analyse(null, deftime * 1000)
    });

    //key bindings
    $(document).keydown(function(e) {
        if (e.keyCode == 39) { //right arrow
            if (e.ctrlKey) {
                $('#btnEnd').click();
            } else {
                $('#btnNext').click();
            }
            return false;
        }
    });

    $(document).keydown(function(e) {
        if (e.keyCode == 37) { //left arrow
            if (e.ctrlKey) {
                $('#btnStart').click();
            } else {
                $('#btnPrevious').click();
            }
        }
        return false;
    });

    $(document).keydown(function(e) {
        if (e.keyCode == 38) { //up arrow
            if (currentGame > 0) {
                if (e.ctrlKey) {
                    loadGame(0);
                } else {
                    loadGame(currentGame - 1);
                }
            }
            $('#gameSelect').val(currentGame);
        }
        return false;
    });

    $(document).keydown(function(e) {
        if (e.keyCode == 40) { //down arrow
            if (currentGame < pgnData.length - 1) {
                if (e.ctrlKey) {
                    loadGame(pgnData.length - 1);
                } else {
                    loadGame(currentGame + 1);
                }
            }
            $('#gameSelect').val(currentGame);
        }
        return false;
    });

    $(document).mousedown(function(e) {
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

    $(document).mouseup(function(e) {
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

//used for clickable moves in gametext
//not used for buttons for efficiency
function mov(ply) {
    if (ply > gameHistory.length - 1) ply = gameHistory.length - 1;
    game.reset();
    for (var i = 0; i <= ply; i++) {
        game.move(gameHistory[i].san);
    }
    currentPly = i - 1;
    board.position(game.fen());
    clearAnnotation()
    displayStatus()
    prepareMove()
}

function onChange() { //fires when the board position changes
    //highlight the current move
    $("[id^='gameMove']").removeClass('highlight');
    $('#gameMove' + currentPly).addClass('highlight');
    clearAnnotation()
}

function loadGame(i) {
    PGNloader(pgnData[i].join('\n'), { newline_char: '\n' })
    currentGame = i;
}

function PGNloader(pgntext) {
    game.reset()
    game.load_pgn(pgntext);
    writeGameText(game);
    gameHistory = game.history({ verbose: true });
    mov(-1);
}

function loadallpgns() {
    //only need the headers here, issue raised on github
    //read all the games to populate the select
    for (var i = 0; i < pgnData.length; i++) {
        var g = new Chess();
        g.load_pgn(pgnData[i].join('\n'), { newline_char: '\n' });
        var h = g.header();
        $('#gameSelect')
            .append($('<option></option>')
                .attr('value', i)
                .text(h.White + ' - ' + h.Black + ', ' + h.Event + ' ' + h.Site + ' ' + h.Date));
    }
}

function computePath(s1, s2) {
    var COLUMNS = 'abcdefgh'.split('')
    var SQUARE_SIZE = $(".square-55d63.black-3c85d.square-a1").css("width").replace("px", "")

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

    var path = ["M", SQUARE_SIZE * (start.x + 0.5), SQUARE_SIZE * (start.y + 0.5)];
    if (corner !== undefined) {
        path.push("L", SQUARE_SIZE * (corner.x + 0.5), SQUARE_SIZE * (corner.y + 0.5));
    }
    path.push("L", SQUARE_SIZE * (end.x + epsilon.x + 0.5), SQUARE_SIZE * (end.y + epsilon.y + 0.5));

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
};
var addArrowAnnotation = function(source, target, nodouble = true, eval) {
    if (arrowannotations[source] == target) {
        delete arrowannotations[source]
        if (nodouble) {
            removeArrowAnnotation(source, target)
            return
        }
    }

    arrowannotations[source] = target
    var SQUARE_SIZE = $(".square-55d63.black-3c85d.square-a1").css("width").replace("px", "")
    var groupEl = overlayEl.find('> .square-' + source);
    if (!groupEl.length) {
        groupEl = createSvgEl("g", {
            'class': CSSx['overlayGroup'] + " square-" + source
        });
        overlayEl.append(groupEl);
    }

    $(groupEl).css("opacity", Math.abs(eval / 100) + 0.5)

    var pathEl = overlayEl.find("> g.square-" + source + " > path.square-" + target);
    if (!pathEl.length) {
        var pathEl = createSvgEl("path", {
            'class': CSSx['overlayArrow'] + " square-" + target,
            'd': computePath(source, target),
            'stroke-width': (SQUARE_SIZE / 3)
        });
        groupEl.append(pathEl);
    }
}

var removeArrowAnnotation = function(source, target) {
    overlayEl.find(
        '> g.square-' + source +
        (target !== undefined ? ' > path.square-' + target : '')
    ).remove();
}

var clearAnnotation = function() {
    arrowannotations = {}
    buildOverlay();
}

var CSSx = {
    overlay: 'overlay-4fc5e',
    overlayArrow: 'overlay-arrow-9d6ed',
    overlayGroup: 'overlay-group-672a1'
}

var overlayEl;

function buildOverlayElement() {
    var SQUARE_SIZE = $(".square-55d63.black-3c85d.square-a1").css("width").replace("px", "")
    $(".board-b72b1").before('<svg class="overlay-4fc5e"></svg>')
    overlayEl = $(".overlay-4fc5e")
    buildOverlay();

    overlayEl.css('width', (SQUARE_SIZE * 8) + 'px');
    overlayEl.css('height', (SQUARE_SIZE * 8) + 'px');
    overlayEl.css('padding', $(".board-b72b1").css("border-top-width"));

}

function mainfunction() {
    board = new ChessBoard('board', cfg);
    window.onresize = function() { board.resize() }

    buildOverlayElement()

    game = new Chess();
    loadallpgns()
    game.reset();
    uciCmd('uci');
    // uciCmd('setoption name MultiPV value 3');
    uciCmd('ucinewgame');
    uciCmd('isready');
    engineStatus.engineReady = false;
    engineStatus.search = null;
    evaluation_el = document.getElementById("evaluation")
    displayStatus();
    prepareMove();
}

//analysis code
var evalres = 0
var preevalres = 0
var analysislog = { move: [], anno: [], color: [], eval: [] }

function Analyse(pgn = null, time = 200) {
    analysislog = { "move": [], "anno": [0, 0.8, 0.9700000000000001, 0.49, -0.07, -0.37, 0.02, 0.46, 1.57, 2.16, 1.82, 1.96, 2.5, -0.5799999999999998, -3.78, -3.8, -3.82, -3.63, -3.5300000000000002, -3.9, -4.68, -4.779999999999999, -4.38, -4.13, -4.07, -4.23, -4.08, -4.02, -4.48, -5.68, -6.48, -6.48, -6.630000000000001, -6.99, -7.470000000000001, -9.11, -9.41, -7.3, -5.08, -3.9, -3.9, -3.9, -3.46, -3.9000000000000004, -4.78, -4.220000000000001, -3.66, -3.95, -2.12, 0, 0, 0, -1.85, -2.69, -0.84, 0, 0, 0, 0, 0, 0], "color": ["black", "grey", "grey", "grey", "black", "black", "grey", "grey", "grey", "grey", "grey", "grey", "grey", "black", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "red", "red", "red", "red", "red", "red", "red", "red", "red", "red", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "orange", "yellow", "grey", "grey", "grey", "yellow", "yellow", "black", "grey", "grey", "grey", "grey", "grey", "grey"], "eval": [0, 0.8, 0.17, 0.32, -0.39, 0.02, 0, 0.46, 1.11, 1.05, 0.77, 1.19, 1.31, -1.89, -1.89, -1.91, -1.91, -1.72, -1.81, -2.09, -2.59, -2.19, -2.19, -1.94, -2.13, -2.1, -1.98, -2.04, -2.44, -3.24, -3.24, -3.24, -3.39, -3.6, -3.87, -5.24, -4.17, -3.13, -1.95, -1.95, -1.95, -1.95, -1.51, -2.39, -2.39, -1.83, -1.83, -2.12, 0, 0, 0, 0, -1.85, -0.84, 0, 0, 0, 0, 0, 0, 0] }
    console.log(analysislog)
    drawChart(analysislog.anno)
        // analysislog = { move: [], anno: [], color: [], eval: [] }
        // if (pgn == null) { pgn = get_moves().trim().split(" ") }
        // // pgn = pgn.trim().split(" ")
        // uciCmd("ucinewgame")
        // evalres = -1
        // analysislog.color.push("black")
        // analysislog.anno.push(0)
        // analysislog.eval.push(0)
        // movebymoveanalyse(pgn, time)
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
            anno = "excellent move"
            plycolor = "blue"
        } else if (diff >= 3) {
            anno = "best move"
            plycolor = "green"
        } else if (diff >= 0) {
            anno = "good move"
            plycolor = "grey"
        }
        if (plycolor != "black") $("#gameMove" + ply).css("color", plycolor)

        analysislog.color.push(plycolor)
        analysislog.anno.push(diff)

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
        // uciCmd(`position startpos moves ${moves.slice(0,-1).join(" ").trim()}`);
        // uciCmd(`go searchmoves ${moves[moves.length-1]} depth 15`) // movetime ${time-100}`)
        // setTimeout(movebymoveanalyse, time, moves.slice(0, -1), time, count + 1);
    let startposmoves = moves.slice(0, count).join(" ").trim()
    if (startposmoves == "") {
        uciCmd(`position startpos`);
    } else {
        uciCmd(`position startpos moves ${startposmoves}`);
    }
    uciCmd(`go searchmoves ${moves[count]} movetime ${time-100}`)
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
            onClick: function(c, i) {
                if (i[0] != undefined) mov(i[0]._index)
            }
        }
    });
}

// https://lichess.org/HaUeZaAV/white#2

// [Event "Rated Blitz game"]
// [Site "https://lichess.org/HaUeZaAV"]
// [Date "2020.08.21"]
// [White "SohamKorade"]
// [Black "gambithero"]
// [Result "1/2-1/2"]
// [UTCDate "2020.08.21"]
// [UTCTime "16:17:22"]
// [WhiteElo "1497"]
// [BlackElo "1472"]
// [WhiteRatingDiff "-1"]
// [BlackRatingDiff "+1"]
// [Variant "Standard"]
// [TimeControl "180+2"]
// [ECO "A45"]
// [Opening "Indian Game"]
// [Termination "Normal"]
// [Annotator "lichess.org"]

// 1. d4 Nf6 { A45 Indian Game } 2. Bf4 d6?! { (-0.09 → 0.43) Inaccuracy. e6 was best. } (2... e6 3. c4 d5 4. e3 c5 5. Nc3 cxd4 6. exd4 Nc6 7. c5) 3. e3 c6 4. Nf3 g5?? { (0.01 → 2.33) Blunder. Nh5 was best. } (4... Nh5 5. Nbd2 Nd7 6. Bd3 Nxf4 7. exf4 g6 8. O-O Bg7 9. Re1) 5. Bxg5 Bg4 6. h3?? { (2.60 → -2.69) Blunder. Bxf6 was best. } (6. Bxf6 exf6 7. Nbd2 Nd7 8. a4 Rg8 9. Bd3 Be6 10. O-O Bh3 11. Ne1 Bg4 12. Qc1 d5) 6... Bxf3 7. Qxf3 Qa5+ 8. Nc3 Qxg5 9. Bd3 Rg8 10. Rg1 Nbd7 11. O-O-O O-O-O 12. Kb1 Kb8 13. Ne4 Nxe4 14. Bxe4 Nf6 15. Bxc6? { (-3.18 → -6.19) Mistake. Bd3 was best. } (15. Bd3 d5) 15... bxc6 16. Qxc6 Rc8 17. Qa6 Qd5 18. Rd3 Rc6 19. Rb3+ Rb6 20. Rxb6+ axb6 21. Qxb6+ Qb7?! { (-5.04 → -3.38) Inaccuracy. Kc8 was best. } (21... Kc8 22. g4 e6 23. Qa6+ Kd7 24. c4 Qe4+ 25. Ka1 Ke7 26. c5 dxc5 27. dxc5 Nd5 28. Rc1) 22. Qd8+ Ka7 23. Qa5+ Qa6 24. Qc7+ Qb7 25. Qa5+ Kb8 26. Qd8+ Qc8 27. Qb6+ Qb7?? { (-3.43 → 0.00) Blunder. Ka8 was best. } (27... Ka8 28. g4 Qb7 29. Qa5+ Qa7 30. Qb5 Qd7 31. Qa5+ Kb8 32. g5 Qc7 33. Qf5 h6 34. h4) 28. Qd8+ Qc8 29. Qb6+ Qb7?? { (-3.36 → 0.00) Blunder. Ka8 was best. } (29... Ka8 30. g4 Qb7 31. Qa5+ Qa7 32. Qb5 Qd7 33. Qa5+ Kb8 34. g5 Qc7 35. Qf5 Qb7 36. h4) 30. Qd8+ Qc8 { The game is a draw. } 1/2-1/2