import type { ExtensionResources } from "./zh";

const resource: ExtensionResources = {
  popup: {
    header: "Sniffer MediaGo",
    clear: "Azzera",
    importAll: "Importa tutto",
    importAllWithCount: "Importa tutto ({{count}})",
    settings: "Impostazioni",
    imported: "Importate {{count}} attività",
    importFailed: "Importazione fallita",
  },
  status: {
    detecting: "Rilevamento",
    schemaMode: "Modo schema",
    notConfigured: "Non configurato",
    connectionFailed: "Connessione fallita",
  },
  empty: {
    title: "Nessuna risorsa scaricabile rilevata in questa pagina.",
    hint: "Durante la navigazione le sorgenti corrispondenti vengono visualizzate automaticamente qui.",
    reloadPage: "Ricarica la pagina corrente",
    openSettings: "Apri impostazioni",
  },
  source: {
    unnamed: "(senza titolo)",
    import: "Importa",
    inspecting: "Analisi in corso",
    autoBest: "Migliore automatico",
    qualityUnknown: "Qualità sconosciuta",
  },
  options: {
    pageTitle: "Impostazioni estensione MediaGo",
    language: {
      title: "Lingua interfaccia",
      description: `Lingua usata dal popup e dalla pagina delle opzioni. Scelte "Usa stessa lingua sistema" in base alla lingua dell'interfaccia utente del browser.`,
      system: "Usa stessa lingua sistema",
      zh: "中文",
      en: "English",
      it: "Italiano",
    },
    server: {
      title: "Modalità spedizione",
      description:
        "L'estensione non fallisce mai silenziosamente. Una volta scelta una modalità, qualsiasi errore viene segnalato così com'è: se necessario cambia modalità manualmente in questa pagina.",
      modeSchemaTitle: "Desktop · Protocollo schema",
      modeSchemaDesc:
        "Apre MediaGo Desktop tramite mediago-community:// e mostra una finestra di revisione precompilata. Desktop viene avviato automaticamente se necessario.",
      modeDesktopHttpTitle: "Desktop · HTTP locale",
      modeDesktopHttpDesc:
        "Parla con l'app desktop in esecuzione tramite {{base}}. Richiede che l'app desktop sia in esecuzione, ma non c'è nessuna finestra di conferma.",
      modeDockerHttpTitle: "Docker / HTTP self-hosted",
      modeDockerHttpDesc:
        "Connettiti ad una distribuzione Docker remota o a qualsiasi server MediaGo self-hosted. Richiede una URL del server; quando l'autenticazione è abilitata aggiungi una chiave API.",
      serverUrlLabel: "URL server",
      serverUrlPlaceholder: "http://your-host:8899",
      apiKeyLabel: "Chiave API",
      apiKeyOptional: "(opzionale)",
      apiKeyPlaceholder: "Lascia vuoto per saltare l'intestazione X-API-Key",
      schemaNoteLead: "Usa il nuovo",
      schemaNoteMid:
        "protocollo Share Intent per richiamare Desktop. La scheda attiva apre l'URL del protocollo. Quando Chrome mostra per la prima volta 'Apri MediaGo-community?', scegli",
      schemaAllow: "Consenti",
      schemaAlways: "Consenti sempre",
      schemaAfter:
        "così Chrome non chiederà più; MediaGo mostrerà comunque la finestra di revisione.",
      limitationLabel: "Limitazione",
      limitationBody:
        "Lo schema invia un'attività senza intestazioni. Usa HTTP per batch o sorgenti che richiedono intestazioni.",
      desktopHttpNoteLead: "Collegati sempre a",
      desktopHttpNoteTail:
        "Il desktop ascolta automaticamente all'avvio; per verificare che sia online usa 'Verifica connessione'.",
    },
    importBehaviour: {
      title: "Comportamento importazione",
      httpDescription:
        "Le modalità HTTP possono aggiungere attività direttamente e avviare subito il download.",
      schemaReviewOnly:
        "La modalità Schema apre MediaGo con una finestra di revisione e non crea né avvia attività automaticamente.",
      downloadNowLabel: "Avvia immediatamente download",
      downloadNowDesc:
        "ON: l'attività viene aggiunta e avviata. OFF: viene solo aggiunta all'elenco. Si applica solo alle modalità HTTP.",
    },
    rules: {
      title: "Regole sniffing",
      descriptionLead: "Le regole vengono mantenute centralmente in",
      descriptionTail:
        "e condivise tra app desktop e l'estensione del browser.",
      m3u8Label: "Stream HLS/m3u8",
      directLabel: "File multimediali diretti",
      bilibiliLabel: "Pagine video Bilibili",
      youtubeLabel: "YouTube",
    },
  },
  common: {
    save: "Salva",
    saved: "Salvato",
    saveFailed: "Impossibile salvare",
    testConnection: "Test connessione",
  },
  errors: {
    serverUrlRequired: "Prima inserisci l'URL del server",
    dockerServerRequired: "La modalità Docker richiede una URL del server",
    schemaBatchNotSupported:
      "La modalità schema può inviare solo un'attività alla volta. Per le importazioni batch passa alla modalità HTTP (pagina Opzioni).",
    schemaNoActiveTab:
      "Nessuna scheda attiva nella finestra attuale: impossibile richiamare il protocollo",
    schemaHeadersNotSupported:
      "La modalità Schema non invia le intestazioni; usa la modalità HTTP per questa sorgente.",
    schemaInvoked:
      "Invocato mediago-community://: se la finestra desktop non viene visualizzata, assicurati che MediaGo Desktop sia installato.",
    serverNotConfigured: "Server MediaGo non configurato",
    dockerNotConfigured:
      "La modalità Docker non ha ancora un URL del server- configura il server nella pagina delle opzioni.",
    unknown: "{{detail}}",
  },
};

export default resource;
