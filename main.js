(function (plugin) {
    // =========================================================================
    // SEÇÃO 1: INICIALIZAÇÃO DO PLUGIN E CONFIGURAÇÕES DE METADADOS
    // =========================================================================
    var config = {
        pluginInfo: plugin.getDescriptor(),
 prefix: plugin.getDescriptor().id,
 logo: plugin.path + "logo.png"
    };

    var defaultDomain = "https://thepiratebay.zone";
    var selectedDomain = defaultDomain;
    var customDomain = "";
    var customTrackersInput = "";

    var service = plugin.createService(config.pluginInfo.title || "The Pirate Bay", config.prefix + ":start", "video", true, config.logo);
    var settings = plugin.createSettings(config.pluginInfo.title || "The Pirate Bay", config.logo, config.pluginInfo.synopsis);

    // =========================================================================
    // SEÇÃO 2: SISTEMA DE LOGS COM NOTIFICAÇÃO FILTRADA NA TELA
    // =========================================================================
    var enableLogs = true;

    function log(tag, mensagem) {
        if (!enableLogs) return;
        var textoFinal = "[" + tag + "] " + mensagem;

        if (typeof print === "function") {
            print("[TPB-LOG]" + textoFinal);
        } else if (typeof console !== "undefined" && console.log) {
            console.log("[TPB-LOG]" + textoFinal);
        }

        try {
            var eAvisoRelevante = /WIKIDATA|ERR|FATAL|FAIL/i.test(tag);

            if (eAvisoRelevante && typeof showtime !== "undefined" && typeof showtime.notify === "function") {
                showtime.notify("[TPB] " + tag + ": " + mensagem, 4);
            }
        } catch (e) {
            // Ignora caso a API de notificação falhe
        }
    }

    function safeHttpReq(url) {
        try {
            log("HTTP_REQ", "Solicitando URL: " + url);
            var res = showtime.httpReq(url, httpOptions);
            if (!res) {
                log("HTTP_ERR", "Resposta nula/vazia para: " + url);
                return "";
            }
            return res.toString();
        } catch (e) {
            log("HTTP_ERR", "Exceção na requisição (" + url + "): " + e);
            return "";
        }
    }

    var httpOptions = {
        timeout: 8000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
 'Connection': 'close'
        }
    };

    // =========================================================================
    // SEÇÃO 3: FUNÇÕES UTILITÁRIAS E SANITIZAÇÃO DE TEXTO
    // =========================================================================

    function safeDecode(str) {
        if (!str) return "";
        try {
            return decodeURIComponent(str);
        } catch (e) {
            log("DECODE_ERR", "Falha ao decodificar URI string ('" + str + "'): " + e);
            return str;
        }
    }

    function removerAcentosEEspeciais(texto) {
        if (!texto) return "";
        var res = texto;
        try {
            res = res.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        } catch (e) {
            log("NORM_WARN", "normalize('NFD') indisponível, usando substituição manual.");
            res = res.replace(/[àáâãä]/gi, 'a')
            .replace(/[èéêë]/gi, 'e')
            .replace(/[ìíîï]/gi, 'i')
            .replace(/[òóôõö]/gi, 'o')
            .replace(/[ùúûü]/gi, 'u')
            .replace(/[ç]/gi, 'c');
        }
        return res.replace(/[\/&!?:;,\-_+=()\[\]{}#@$%^&*~"'\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function parseTerms(rawString) {
        if (!rawString || typeof rawString !== 'string') return [];
        return rawString.split(',')
        .map(function(item) { return item.trim().toLowerCase(); })
        .filter(function(item) { return item.length > 0; });
    }

    function getBaseUrl() {
        var active = (customDomain && customDomain.length > 0) ? customDomain : selectedDomain;
        active = active.trim();
        if (!/^https?:\/\//i.test(active)) {
            active = "https://" + active;
        }
        return active.replace(/\/+$/, '');
    }

    config.urls = {
        base: getBaseUrl()
    };

    var cacheGrupos = {};

    var DEFAULT_QUALITY_TERMS = "1080p, 720p, 4k, 2160p, web-dl, bluray, hdtv";
    var DEFAULT_CODEC_TERMS = "x264, h264, hevc, x265, xvid, avc, h265";

    var useWikidata = true;
    var filterAdult = true;
    var filterQualityTerms = DEFAULT_QUALITY_TERMS;
    var filterCodecTerms = DEFAULT_CODEC_TERMS;
    var minSeeders = 1;
    var searchCategory = "0";
    var sortOrder = "seeders";
    var tpbSortOrder = "7";
    var maxGB = 15;
    var minYear = 0;
    var filterSkull = "all";

    // Helper para forçar a atualização visual de cada item no Movian
    function setSettingValue(settingObj, val) {
        if (!settingObj) return;
        try {
            if (typeof settingObj.set === "function") {
                settingObj.set(val);
            } else {
                settingObj.value = val;
            }
        } catch (e) {
            log("SETTINGS_ERR", "Erro ao redefinir campo: " + e);
        }
    }

    // =========================================================================
    // SEÇÃO 4: CONFIGURAÇÕES DO PLUGIN (HANDLES DE INTERFACE)
    // =========================================================================
    settings.createInfo("info", config.logo, "Plugin The Pirate Bay com busca dupla Wikidata, filtros avançados e diagnóstico.\n");

    settings.createDivider('Ações do Plugin');

    // Botão de Reset que atualiza a GUI nativa do Movian
    settings.createAction("reset_defaults", "Restaurar Configurações Padrão", function () {
        setSettingValue(optEnableLogs, true);
        setSettingValue(optUseWikidata, true);
        setSettingValue(optDomainCustom, "");
        setSettingValue(optDomainSelect, defaultDomain);
        setSettingValue(optFilterAdult, true);
        setSettingValue(optFilterQuality, DEFAULT_QUALITY_TERMS);
        setSettingValue(optFilterCodec, DEFAULT_CODEC_TERMS);
        setSettingValue(optMinSeeders, "1");
        setSettingValue(optSearchCat, "0");
        setSettingValue(optTpbSort, "7");
        setSettingValue(optFilterSkull, "all");
        setSettingValue(optMinYear, "0");
        setSettingValue(optSortOrder, "seeders");
        setSettingValue(optMaxGb, "15");
        setSettingValue(optCustomTrackers, "");

        log("SETTINGS", "Todas as configurações da interface foram restauradas.");

        if (typeof showtime !== "undefined" && typeof showtime.notify === "function") {
            showtime.notify("[TPB] Configurações restauradas com sucesso!", 4);
        }
    });

    settings.createDivider('Configurações de Conexão e Logs');

    var optEnableLogs = settings.createBool("enable_logs", "Ativar Logs de Depuração", true, function (v) {
        enableLogs = v;
        log("SETTINGS", "Status dos logs alterado para: " + enableLogs);
    });

    var optUseWikidata = settings.createBool("use_wikidata", "Ativar Busca Dupla (Wikidata)", true, function (v) {
        useWikidata = v;
        log("SETTINGS", "Busca dupla Wikidata: " + useWikidata);
    });

    var optDomainCustom = settings.createString("domain_custom", "Domínio Personalizado", "", function (v) {
        customDomain = v ? v.trim() : "";
        config.urls.base = getBaseUrl();
        log("SETTINGS", "Domínio personalizado: " + config.urls.base);
    });

    var optDomainSelect = settings.createMultiOpt("domain_select", "Domínio Padrão", [
        ["https://thepiratebay.zone", "thepiratebay.zone"],
        ["https://www3.thepiratebay3.to", "www3.thepiratebay3.to"],
        ["https://thepiratebay.vip", "thepiratebay.vip"],
        ["https://thepiratebay.icu", "thepiratebay.icu"],
        ["http://thepiratebay.cx", "thepiratebay.cx (HTTP)"]
    ], function (v) {
        selectedDomain = v || defaultDomain;
        config.urls.base = getBaseUrl();
        log("SETTINGS", "Domínio padrão: " + selectedDomain);
    });

    settings.createDivider('Filtros de Conteúdo');

    var optFilterAdult = settings.createBool("filter_adult", "Ocultar Conteúdo Adulto / Pornografia", true, function (v) {
        filterAdult = v;
        log("SETTINGS", "Filtro adulto alterado para: " + filterAdult);
    });

    var optFilterQuality = settings.createString("filter_quality_terms", "Qualidades Permitidas (separadas por vírgula)", DEFAULT_QUALITY_TERMS, function (v) {
        filterQualityTerms = v || "";
        log("SETTINGS", "Qualidades permitidas: " + filterQualityTerms);
    });

    var optFilterCodec = settings.createString("filter_codec_terms", "Codecs Permitidos (separados por vírgula)", DEFAULT_CODEC_TERMS, function (v) {
        filterCodecTerms = v || "";
        log("SETTINGS", "Codecs permitidos: " + filterCodecTerms);
    });

    var optMinSeeders = settings.createString("min_seeders", "Seeders Mínimos", "1", function (v) {
        minSeeders = parseInt(v, 10) || 1;
    });

    var optSearchCat = settings.createMultiOpt("search_cat", "Categoria de Pesquisa", [
        ["0", "Tudo (Geral)"],
                                               ["201", "Filmes"],
                                               ["205", "Séries"]
    ], function (v) {
        searchCategory = v || "0";
    });

    var optTpbSort = settings.createMultiOpt("tpb_sort", "Ordenação no TPB", [
        ["7", "Mais Seeders"],
        ["3", "Mais Recentes"],
        ["5", "Maior Tamanho"]
    ], function (v) {
        tpbSortOrder = v || "7";
    });

    var optFilterSkull = settings.createMultiOpt("filter_skull", "Uploader", [
        ["all", "Todos"],
        ["verified", "Apenas Verificados (VIP/Trusted/Helper)"],
                                                 ["vip_only", "Apenas VIP"]
    ], function (v) {
        filterSkull = v || "all";
    });

    var optMinYear = settings.createString("min_year", "Ano Mínimo (0 = Desativado)", "0", function (v) {
        minYear = parseInt(v, 10) || 0;
    });

    var optSortOrder = settings.createMultiOpt("sort_order", "Ordenar Lista Por", [
        ["seeders", "Mais Seeders"],
        ["size_asc", "Menor Tamanho"],
        ["size_desc", "Maior Tamanho"]
    ], function (v) {
        sortOrder = v || "seeders";
    });

    var optMaxGb = settings.createString("max_gb", "Tamanho Máximo em GB (0 = Sem limite)", "15", function (v) {
        maxGB = parseInt(v, 10) || 0;
    });

    var optCustomTrackers = settings.createString("custom_trackers", "Trackers Extras", "", function (v) {
        customTrackersInput = v || "";
    });

    // =========================================================================
    // SEÇÃO 5: LISTA DE TRACKERS E MIRRORS
    // =========================================================================
    var baseTrackersList = [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://open.stealth.si:80/announce",
        "udp://tracker.torrent.eu.org:451/announce",
        "udp://tracker.openbittorrent.com:6969/announce",
        "udp://opentracker.i2p.rocks:6969/announce",
        "udp://tracker.cyberia.is:6969/announce",
        "udp://exodus.desync.com:6969/announce"
    ];

    function obterTrackersFormatados() {
        var lista = baseTrackersList.slice();
        if (customTrackersInput && customTrackersInput.trim().length > 0) {
            var extras = customTrackersInput.split(/[\n,]+/);
            for (var i = 0; i < extras.length; i++) {
                var tr = extras[i].trim();
                if (tr && /^udp:\/\/|^http:\/\//i.test(tr)) {
                    lista.push(tr);
                }
            }
        }
        return lista.map(function(tr) { return "&tr=" + encodeURIComponent(tr); }).join("");
    }

    function obterDominiosParaTentativa() {
        var baseAtual = getBaseUrl();
        var lista = [baseAtual];
        var padroes = [
            "https://thepiratebay.zone",
            "https://www3.thepiratebay3.to",
            "https://thepiratebay.vip",
            "https://thepiratebay.icu",
            "http://thepiratebay.cx",
            "https://tpb.party",
            "https://thepiratebay10.info"
        ];

        for (var i = 0; i < padroes.length; i++) {
            if (padroes[i] !== baseAtual) {
                lista.push(padroes[i]);
            }
        }
        return lista;
    }

    // =========================================================================
    // SEÇÃO 6: CONSULTA WIKIDATA (BUSCA DUPLA)
    // =========================================================================

    function obterTermosExatosWikidata(termoOriginal) {
        var termos = [termoOriginal];
        log("WIKIDATA", "Buscando termo: '" + termoOriginal + "'");

        if (!useWikidata) {
            log("WIKIDATA", "Busca dupla desativada.");
            return termos;
        }

        if (!termoOriginal || termoOriginal.length < 3) {
            log("WIKIDATA", "Termo curto. Ignorando Wikidata.");
            return termos;
        }

        try {
            var urlSearch = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" +
            encodeURIComponent(termoOriginal) +
            "&language=pt&format=json&limit=1";

            var tInicio = new Date().getTime();
            var resSearch = safeHttpReq(urlSearch);
            var duracaoReq = new Date().getTime() - tInicio;

            if (!resSearch) {
                log("WIKIDATA_ERR", "Resposta vazia da API do Wikidata (" + duracaoReq + "ms)");
                return termos;
            }

            var dataSearch = null;
            try {
                dataSearch = JSON.parse(resSearch);
            } catch (eJson) {
                log("WIKIDATA_ERR", "Erro no JSON.parse da Etapa 1: " + eJson);
                return termos;
            }

            if (dataSearch && dataSearch.search && dataSearch.search.length > 0) {
                var entityId = dataSearch.search[0].id;
                var entityLabel = dataSearch.search[0].label || "Sem rotulo";
                log("WIKIDATA", "Entidade encontrada: " + entityId + " (" + entityLabel + ")");

                if (entityId) {
                    var urlEntity = "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=" +
                    entityId + "&props=labels|claims&languages=en|pt&format=json";

                    var resEntity = safeHttpReq(urlEntity);
                    if (resEntity) {
                        var dataEntity = null;
                        try {
                            dataEntity = JSON.parse(resEntity);
                        } catch (eJson2) {
                            log("WIKIDATA_ERR", "Erro no JSON.parse da Etapa 2: " + eJson2);
                            return termos;
                        }

                        if (dataEntity && dataEntity.entities && dataEntity.entities[entityId]) {
                            var entity = dataEntity.entities[entityId];
                            var tituloOriginal = "";

                            if (entity.claims && entity.claims.P1476 && entity.claims.P1476.length > 0) {
                                var claimVal = entity.claims.P1476[0].mainsnak.datavalue.value;
                                if (typeof claimVal === "object" && claimVal.text) {
                                    tituloOriginal = claimVal.text;
                                } else if (typeof claimVal === "string") {
                                    tituloOriginal = claimVal;
                                }
                                log("WIKIDATA", "Titulo Original (P1476): '" + tituloOriginal + "'");
                            }

                            if (!tituloOriginal && entity.labels && entity.labels.en && entity.labels.en.value) {
                                tituloOriginal = entity.labels.en.value;
                                log("WIKIDATA", "Rotulo EN (Ingles): '" + tituloOriginal + "'");
                            }

                            if (tituloOriginal) {
                                var origTratado = removerAcentosEEspeciais(tituloOriginal);
                                if (origTratado && termos.indexOf(origTratado) === -1) {
                                    log("WIKIDATA", "Novo termo adicionado: '" + origTratado + "'");
                                    termos.push(origTratado);
                                }
                            }
                        }
                    }
                }
            } else {
                log("WIKIDATA", "Nenhum resultado no Wikidata para '" + termoOriginal + "'");
            }
        } catch (e) {
            log("WIKIDATA_ERR", "Erro na comunicacao com Wikidata: " + e);
        }

        return termos;
    }

    // =========================================================================
    // SEÇÃO 7: LÓGICAS DE FILTRAGEM E FORMATADORES
    // =========================================================================

    function isAdultContent(title) {
        if (!filterAdult || !title) return false;
        var adultRegex = /\b(xxx|porn|pornografia|adult|18\+|hentai|erotic|sex|ecchi|jav|nsfw|cam|anal|fetish|strip|erotica)\b/i;
        return adultRegex.test(title);
    }

    function matchesQuality(title) {
        if (!title) return true;
        var allowed = parseTerms(filterQualityTerms);
        if (allowed.length === 0) return true;

        var knownQualityRegex = /(2160p|1080p|720p|480p|360p|4k|2k|8k|bluray|web-?dl|webrip|hdrip|dvdrip|hdtv|hd|sd|cam|ts|tc)/i;
        var hasTag = knownQualityRegex.test(title);

        if (!hasTag) return true;

        var lowerTitle = title.toLowerCase();
        for (var i = 0; i < allowed.length; i++) {
            if (lowerTitle.indexOf(allowed[i]) !== -1) return true;
        }
        return false;
    }

    function matchesCodec(title) {
        if (!title) return true;
        var allowed = parseTerms(filterCodecTerms);
        if (allowed.length === 0) return true;

        var knownCodecRegex = /(x264|h264|hevc|x265|xvid|divx|avc|h265)/i;
        var hasTag = knownCodecRegex.test(title);

        if (!hasTag) return true;

        var lowerTitle = title.toLowerCase();
        for (var i = 0; i < allowed.length; i++) {
            if (lowerTitle.indexOf(allowed[i]) !== -1) return true;
        }
        return false;
    }

    function construirUrlPagina(domainBase, pathAndQuery, pageNum) {
        var pageIdx = (pageNum <= 1) ? 0 : pageNum;
        var sortCode = tpbSortOrder || "7";

        var browseMatch = /^\/browse\/(\d+)/i.exec(pathAndQuery);
        if (browseMatch) {
            return domainBase + "/browse/" + browseMatch[1] + "/" + pageIdx + "/" + sortCode;
        }

        if (/^\/top\//i.test(pathAndQuery)) {
            return domainBase + pathAndQuery;
        }

        var searchRestMatch = /^\/search\/([^\/]+)(?:\/(\d+)\/(\d+)\/(\d+))?/i.exec(pathAndQuery);
        if (searchRestMatch) {
            var termoRest = searchRestMatch[1];
            var catRest = searchRestMatch[4] || searchCategory || "0";
            return domainBase + "/search/" + termoRest + "/" + pageIdx + "/" + sortCode + "/" + catRest;
        }

        return domainBase + pathAndQuery;
    }

    function obterTagCaveiraEUploader(rowContent) {
        if (!rowContent) return "";
        var uploaderMatch = /href=["']?\/user\/([^\/"'\s>]+)["']?/i.exec(rowContent);
        var uploader = uploaderMatch ? uploaderMatch[1] : "";
        var userText = uploader ? " - " + uploader : "";

        if (/alt=["']?VIP["']?|title=["']?VIP["']?|\bvip\.(gif|png|jpg)\b/i.test(rowContent)) return "[VIP" + userText + "] ";
        if (/alt=["']?Trusted["']?|title=["']?Trusted["']?|\btrusted\.(gif|png|jpg)\b/i.test(rowContent)) return "[TRUSTED" + userText + "] ";
        if (/alt=["']?Helper["']?|title=["']?Helper["']?|\bhelper\.(gif|png|jpg)\b/i.test(rowContent)) return "[HELPER" + userText + "] ";
        if (/alt=["']?Moderator["']?|title=["']?Moderator["']?|\bmoderator\.(gif|png|jpg)\b/i.test(rowContent)) return "[MOD" + userText + "] ";
        if (uploader) return "[" + uploader + "] ";
        return "";
    }

    function atendeFiltroCaveira(tagCaveira) {
        if (filterSkull === "all") return true;
        if (filterSkull === "verified") return /VIP|TRUSTED|HELPER|MOD/.test(tagCaveira);
        if (filterSkull === "vip_only") return /VIP/.test(tagCaveira);
        return true;
    }

    function obterTagSaude(seeders) {
        if (seeders >= 30) return "[Saude: Alta] ";
        if (seeders >= 5) return "[Saude: Media] ";
        return "[Saude: Baixa] ";
    }

    function extrairAnoDoTitulo(nome) {
        var match = /\b(19\d{2}|20\d{2})\b/.exec(nome);
        return match ? parseInt(match[1], 10) : 0;
    }

    function atendeFiltroAno(nome) {
        if (minYear <= 0) return true;
        var ano = extrairAnoDoTitulo(nome);
        return ano === 0 || ano >= minYear;
    }

    function extrairTituloBase(nome) {
        if (!nome) return "";
        var limpo = nome
        .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
.replace(/\bS\d+E\d+\b|\bS\d+\b|\bE\d+\b|\bTemporada\s*\d+\b|\bSeason\s*\d+\b/gi, '')
.replace(/\b(1080p|720p|480p|360p|2160p|4k|uhd|fhd|hd|sd|dvdrip|web-?dl|webrip|bluray|bdrip|x264|x265|hevc|h264|aac|5\.1|dual|dublado|legendado|subbed|pt-?br|multi|audio|áudio|torrent|repack|complete)\b/gi, '')
.replace(/\b(19|20)\d{2}\b/g, '')
.replace(/[._-]/g, ' ')
.replace(/\s+/g, ' ')
.trim();

return limpo.length > 1 ? limpo : nome;
    }

    function limparTituloExibicao(nome) {
        if (!nome) return "";
        return nome
        .replace(/\[[^\]]*\]/g, '')
        .replace(/[._]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function extrairTamanhoMB(rowText) {
        var match = /Size\s+([0-9.]+)\s*(GiB|MiB|GB|MB|KiB|KB)/i.exec(rowText);
        if (!match) return 0;
        var val = parseFloat(match[1]);
        var unit = match[2].toUpperCase();
        if (unit === 'GIB' || unit === 'GB') return val * 1024;
        if (unit === 'MIB' || unit === 'MB') return val;
        if (unit === 'KIB' || unit === 'KB') return val / 1024;
        return 0;
    }

    function formatarTamanho(mb) {
        if (!mb || mb <= 0) return "";
        if (mb >= 1024) return " [" + (mb / 1024).toFixed(1) + " GB]";
        return " [" + Math.round(mb) + " MB]";
    }

    function obterTagResolucao(nome) {
        if (/2160p|4k|uhd/i.test(nome)) return "[4K] ";
        if (/1080p|fhd/i.test(nome)) return "[1080p] ";
        if (/720p|hd/i.test(nome)) return "[720p] ";
        if (/480p|360p|sd|dvdrip|xvid/i.test(nome)) return "[SD] ";
        return "";
    }

    function obterTagCodec(nome) {
        if (/x265|hevc|h\.?265/i.test(nome)) return "[H265] ";
        if (/x264|h\.?264/i.test(nome)) return "[H264] ";
        return "";
    }

    function obterTagAudio(nome) {
        var tags = "";
        if (/dual[\s_-]*á?udio|dual|multi[\s_-]*á?udio/i.test(nome)) tags += "[DUAL] ";
        else if (/dublado|\bdub\b/i.test(nome)) tags += "[DUB] ";

        if (/legendado|\bleg\b|subbed/i.test(nome)) tags += "[LEG] ";
        else if (/\bpt[-_]?br\b/i.test(nome) && tags === "") tags += "[PT-BR] ";

        return tags;
    }

    function setPageHeader(page, title) {
        page.type = "directory";
        if (page.metadata) {
            page.metadata.title = title;
            page.metadata.logo = config.logo;
        }
    }

    function criarRotaMagnet(magnet, title) {
        var payload = JSON.stringify({ magnet: magnet, title: title });
        return config.prefix + ":play_magnet:" + encodeURIComponent(payload);
    }

    function criarRotaTorrent(url, title) {
        var payload = JSON.stringify({ url: url, title: title });
        return config.prefix + ":torrent:" + encodeURIComponent(payload);
    }

    // =========================================================================
    // SEÇÃO 8: SCRAPER E TESTE DE PROXIES / MIRRORS
    // =========================================================================

    function processarListaTorrents(page, pathOrTerm, pageNum, context) {
        page.type = "directory";
        pageNum = parseInt(pageNum || 1, 10);

        page.appendItem(config.prefix + ":search_input:", "search", {
            title: "Pesquisar no The Pirate Bay"
        });

        page.loading = true;

        try {
            var dominios = obterDominiosParaTentativa();

            var termosPesquisa = [pathOrTerm];
            if (context && context.type === "search") {
                termosPesquisa = obterTermosExatosWikidata(pathOrTerm);
            }

            var urlsVistas = {};
            var grupos = {};
            var ordemGrupos = [];

            for (var t = 0; t < termosPesquisa.length; t++) {
                var termoAtual = termosPesquisa[t];
                var targetPath = pathOrTerm;

                if (context && context.type === "search") {
                    targetPath = '/search/' + encodeURIComponent(termoAtual) + '/0/' + tpbSortOrder + '/' + searchCategory;
                }

                var htmlContent = null;

                log("PROXIES", "Testando mirrors para: '" + termoAtual + "'");

                for (var d = 0; d < dominios.length; d++) {
                    var domainBase = dominios[d];
                    var paginatedUrl = construirUrlPagina(domainBase, targetPath, pageNum);

                    var tInicio = new Date().getTime();
                    var res = safeHttpReq(paginatedUrl);
                    var tDelta = new Date().getTime() - tInicio;

                    if (res && (res.indexOf('pirate') !== -1 || res.indexOf('search') !== -1 || res.indexOf('<tr') !== -1 || res.indexOf('main-content') !== -1)) {
                        htmlContent = res;
                        log("PROXIES", "Mirror responsivo (" + tDelta + "ms): " + domainBase);
                        break;
                    } else {
                        log("PROXIES", "Mirror sem HTML valido (" + tDelta + "ms): " + domainBase);
                    }
                }

                if (!htmlContent) {
                    log("PROXIES_ERR", "Nenhum proxy respondeu para '" + termoAtual + "'");
                    continue;
                }

                var rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
                var matchRow;
                var capturadosNoTermo = 0;

                while ((matchRow = rowRegex.exec(htmlContent)) !== null) {
                    var rowContent = matchRow[1];

                    var linkMatch = /class="detLink"[^>]*>([\s\S]*?)<\/a>/i.exec(rowContent) ||
                    /<a\s+[^>]*href="(?:\/torrent|\/description\.php)[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(rowContent);
                    if (!linkMatch) continue;

                    var linkTitle = linkMatch[1].replace(/<[^>]+>/g, '').trim();
                    if (!linkTitle || linkTitle.length < 3 || /^(next|previous|top|browse|details|comments|main)$/i.test(linkTitle)) {
                        continue;
                    }

                    if (isAdultContent(linkTitle)) continue;
                    if (!matchesQuality(linkTitle)) continue;
                    if (!matchesCodec(linkTitle)) continue;

                    var tagCaveira = obterTagCaveiraEUploader(rowContent);
                    if (!atendeFiltroCaveira(tagCaveira)) continue;
                    if (!atendeFiltroAno(linkTitle)) continue;

                    var magnetMatch = /href=["']?(magnet:\?xt=urn:btih:[^"'\s>]+)["']?/i.exec(rowContent);
                    var magnetDirect = magnetMatch ? magnetMatch[1] : null;

                    var urlMatch = /href="(\/(?:torrent|description\.php)[^"]+)"/i.exec(rowContent);
                    var linkUrl = urlMatch ? urlMatch[1] : null;

                    var keyVista = magnetDirect || linkUrl;
                    if (!keyVista || urlsVistas[keyVista]) continue;
                    urlsVistas[keyVista] = true;

                    var tamanhoMB = extrairTamanhoMB(rowContent);
                    if (maxGB > 0 && tamanhoMB > (maxGB * 1024)) continue;

                    var tds = rowContent.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
                    var seeders = 0;

                    if (tds && tds.length >= 2) {
                        var seederTd = tds[tds.length - 2];
                        var seederText = seederTd.replace(/<[^>]+>/g, '').trim();
                        var seMatch = /(\d+)/.exec(seederText);
                        if (seMatch) {
                            seeders = parseInt(seMatch[1], 10);
                        }
                    }

                    if (seeders === 0 && magnetDirect) {
                        seeders = 1;
                    }

                    if (seeders < minSeeders) continue;

                    var tagSaude = obterTagSaude(seeders);
                    var tagRes = obterTagResolucao(linkTitle);
                    var tagCodec = obterTagCodec(linkTitle);
                    var tagAudio = obterTagAudio(linkTitle);
                    var tagSe = " [SE: " + seeders + "]";
                    var tagSize = formatarTamanho(tamanhoMB);

                    var tituloLimpo = limparTituloExibicao(linkTitle);
                    var tituloFormatado = tagCaveira + tagSaude + tagRes + tagCodec + tagAudio + tituloLimpo + tagSize + tagSe;

                    var tituloBase = extrairTituloBase(linkTitle);
                    var chaveGroup = tituloBase.toLowerCase();

                    if (!grupos[chaveGroup]) {
                        grupos[chaveGroup] = {
                            tituloBase: tituloBase,
                            itens: []
                        };
                        ordemGrupos.push(chaveGroup);
                    }

                    grupos[chaveGroup].itens.push({
                        url: linkUrl,
                        title: linkTitle,
                        formattedTitle: tituloFormatado,
                            seeders: seeders,
                            magnet: magnetDirect,
                            tamanhoMB: tamanhoMB
                    });

                    capturadosNoTermo++;
                }
                log("PARSE", "Termo '" + termoAtual + "': " + capturadosNoTermo + " torrents validados.");
            }

            var totalExibido = 0;

            for (var i = 0; i < ordemGrupos.length; i++) {
                var chave = ordemGrupos[i];
                var grupo = grupos[chave];

                grupo.itens.sort(function (a, b) {
                    if (sortOrder === "size_asc") return a.tamanhoMB - b.tamanhoMB;
                    if (sortOrder === "size_desc") return b.tamanhoMB - a.tamanhoMB;
                    return b.seeders - a.seeders;
                });

                if (grupo.itens.length === 1) {
                    var itemUnico = grupo.itens[0];
                    var routeUri = itemUnico.magnet
                    ? criarRotaMagnet(itemUnico.magnet, itemUnico.title)
                    : criarRotaTorrent(itemUnico.url, itemUnico.title);

                    page.appendItem(routeUri, "directory", {
                        title: itemUnico.formattedTitle,
                        icon: config.logo,
                        description: itemUnico.formattedTitle
                    });
                } else {
                    var cacheKey = encodeURIComponent(chave + "_" + pageNum);
                    cacheGrupos[cacheKey] = grupo;

                    page.appendItem(config.prefix + ":folder:" + cacheKey, "directory", {
                        title: "[Opcoes] " + grupo.tituloBase + " (" + grupo.itens.length + " opcoes)",
                                    icon: config.logo,
                                    description: "Possui " + grupo.itens.length + " opcoes disponiveis para reproducao."
                    });
                }
                totalExibido++;
            }

            if (context) {
                var proximaPagina = pageNum + 1;
                var nextUri = "";

                if (context.type === "search") {
                    nextUri = config.prefix + ":search_page:" + encodeURIComponent(context.query) + ":" + proximaPagina;
                } else if (context.type === "category") {
                    nextUri = config.prefix + ":category_page:" + encodeURIComponent(context.url) + ":" + encodeURIComponent(context.name) + ":" + proximaPagina;
                }

                if (nextUri) {
                    page.appendItem(nextUri, "directory", {
                        title: ">> Proxima Pagina (Pagina " + proximaPagina + ")"
                    });
                }
            }

            log("RENDER", "Renderizacao concluida. Total de itens exibidos: " + totalExibido);

            if (totalExibido === 0) {
                page.error("Nenhum torrent encontrado nesta busca.");
            } else {
                page.entries = totalExibido;
            }

        } catch (eFatal) {
            log("FATAL_ERR", "Excecao no scraper: " + eFatal);
            page.error("Erro interno ao carregar torrents.");
        } finally {
            page.loading = false;
        }
    }

    // =========================================================================
    // SEÇÃO 9: ROTAS DE NAVEGAÇÃO E REPRODUÇÃO
    // =========================================================================

    plugin.addURI(config.prefix + ":folder:(.*)", function (page, cacheKey) {
        var grupo = cacheGrupos[cacheKey];

        if (!grupo) {
            log("ROUTE_ERR", "Chave expirada para a pasta: " + cacheKey);
            page.error("Grupo expirado. Tente buscar novamente.");
            return;
        }

        setPageHeader(page, "Opcoes: " + grupo.tituloBase);

        for (var i = 0; i < grupo.itens.length; i++) {
            var item = grupo.itens[i];
            var routeUri = item.magnet
            ? criarRotaMagnet(item.magnet, item.title)
            : criarRotaTorrent(item.url, item.title);

            page.appendItem(routeUri, "directory", {
                title: item.formattedTitle,
                icon: config.logo,
                description: item.formattedTitle
            });
        }
    });

    plugin.addURI(config.prefix + ":play_magnet:(.*)", function (page, rawData) {
        var data = {};
        try {
            data = JSON.parse(safeDecode(rawData));
        } catch (e) {
            log("ROUTE_ERR", "Erro ao fazer parse dos dados do magnet: " + e);
            data = { magnet: safeDecode(rawData), title: "Torrent" };
        }

        var name = data.title || "Torrent";
        var rawMagnet = data.magnet || "";

        setPageHeader(page, name);

        if (!rawMagnet || rawMagnet.indexOf("magnet:?") !== 0) {
            log("MAGNET_ERR", "Link magnet invalido.");
            page.error("Link magnet invalido.");
            return;
        }

        var finalMagnet = rawMagnet + obterTrackersFormatados();

        page.appendItem("torrent:browse:" + finalMagnet, "directory", {
            title: '[Assistir] ' + name,
            description: name
        });
    });

    plugin.addURI(config.prefix + ":start", function (page) {
        var pages = [
            { url: '/browse/201', name: '[Cat] Filmes (Geral)' },
                  { url: '/browse/205', name: '[Cat] Series (Geral)' },
                  { url: '/browse/299', name: '[Cat] Videos (Outros)' },
                  { url: '/top/201', name: '[Top] Top Filmes' },
                  { url: '/top/205', name: '[Top] Top Series' },
                  { url: '/search/dublado/0/7/201', name: '[Dub] Filmes Dublados' },
                  { url: '/search/dual%20audio/0/7/201', name: '[Dual] Filmes Dual Audio' },
                  { url: '/search/dublado/0/7/205', name: '[Dub] Series Dubladas' },
                  { url: '/search/pt-br/0/7/0', name: '[PT-BR] Conteudo Nacional' }
        ];

        setPageHeader(page, "The Pirate Bay");

        page.appendItem(config.prefix + ":search_input:", "search", {
            title: "Pesquisar no The Pirate Bay"
        });

        for (var i = 0; i < pages.length; i++) {
            page.appendItem(config.prefix + ":category:" + encodeURIComponent(pages[i].url) + ':' + encodeURIComponent(pages[i].name), "directory", {
                title: pages[i].name
            });
        }
    });

    plugin.addURI(config.prefix + ":search_input:(.*)", function (page, query) {
        if (!query) return;
        var termoDigitado = removerAcentosEEspeciais(safeDecode(query));
        setPageHeader(page, "Busca: " + termoDigitado + " (Pag. 1)");
        processarListaTorrents(page, termoDigitado, 1, { type: "search", query: termoDigitado });
    });

    plugin.addURI(config.prefix + ":search_page:(.*):(.*)", function (page, query, pageNum) {
        var termoDigitado = removerAcentosEEspeciais(safeDecode(query));
        var p = parseInt(pageNum, 10) || 1;
        setPageHeader(page, "Busca: " + termoDigitado + " (Pag. " + p + ")");
        processarListaTorrents(page, termoDigitado, p, { type: "search", query: termoDigitado });
    });

    plugin.addSearcher(plugin.getDescriptor().id, config.logo, function (page, query) {
        var termoDigitado = removerAcentosEEspeciais(query);
        setPageHeader(page, "Busca: " + termoDigitado);
        processarListaTorrents(page, termoDigitado, 1, { type: "search", query: termoDigitado });
    });

    plugin.addURI(config.prefix + ":category:(.*):(.*)", function (page, url, name) {
        var categoryTitle = safeDecode(name);
        var categoryPath = safeDecode(url);
        setPageHeader(page, categoryTitle + " (Pag. 1)");
        processarListaTorrents(page, categoryPath, 1, { type: "category", url: categoryPath, name: categoryTitle });
    });

    plugin.addURI(config.prefix + ":category_page:(.*):(.*):(.*)", function (page, url, name, pageNum) {
        var categoryTitle = safeDecode(name);
        var categoryPath = safeDecode(url);
        var p = parseInt(pageNum, 10) || 1;
        setPageHeader(page, categoryTitle + " (Pag. " + p + ")");
        processarListaTorrents(page, categoryPath, p, { type: "category", url: categoryPath, name: categoryTitle });
    });

    plugin.addURI(config.prefix + ":torrent:(.*)", function (page, rawData) {
        var data = {};
        try {
            data = JSON.parse(safeDecode(rawData));
        } catch (e) {
            log("TORRENT_ERR", "Erro ao fazer parse dos dados da rota :torrent: " + e);
            data = { url: safeDecode(rawData), title: "Torrent" };
        }

        var name = data.title || "Torrent";
        var url = data.url || "";

        setPageHeader(page, name);
        page.loading = true;

        try {
            var dominios = obterDominiosParaTentativa();
            var magnetEncontrado = null;

            for (var i = 0; i < dominios.length; i++) {
                var fullUrl = dominios[i] + url;
                log("TORRENT_PAGE", "Buscando magnet no mirror: " + dominios[i]);
                var htmlDoc = safeHttpReq(fullUrl);
                if (htmlDoc) {
                    var magnetMatch = /href=["']?(magnet:\?xt=urn:btih:[^"'\s>]+)["']?/i.exec(htmlDoc);
                    if (magnetMatch && magnetMatch[1]) {
                        magnetEncontrado = magnetMatch[1];
                        log("TORRENT_PAGE", "Magnet extraido com sucesso.");
                        break;
                    }
                }
            }

            if (magnetEncontrado) {
                var finalMagnet = magnetEncontrado + obterTrackersFormatados();
                page.appendItem("torrent:browse:" + finalMagnet, "directory", {
                    title: '[Assistir] ' + name,
                    description: name
                });
            } else {
                log("TORRENT_ERR", "Magnet nao encontrado no HTML do torrent.");
                page.error("Não foi possível localizar o link magnet para este torrent.");
            }
        } catch (eTorr) {
            log("FATAL_ERR", "Excecao na rota :torrent: " + eTorr);
            page.error("Erro interno ao carregar detalhes do torrent.");
        } finally {
            page.loading = false;
        }
    });

})(this);
