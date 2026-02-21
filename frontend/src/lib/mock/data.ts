// ── Types (inline to avoid cross-workspace import complexity in SvelteKit) ──

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "critical" | "high" | "medium" | "low";
export type TicketCategory =
    | "subscription_cancellation" | "refund_request" | "billing_invoice"
    | "flashcard_issues" | "quiz_issues" | "content_upload"
    | "language_issues" | "technical_errors" | "account_issues"
    | "podcast_issues" | "summary_issues" | "mock_exam_issues"
    | "mindmap_issues" | "general_how_to" | "data_loss"
    | "misunderstanding" | "garbage";

export type TicketTag = "ai_draft" | "auto_closed" | "ai_processed" | "needs_review";
export type TicketSource = "web" | "mobile" | "email";
export type ReplySource = "draft" | "agent";

export interface Ticket {
    id: string;
    subject: string;
    from: string;
    fromEmail: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    tags: TicketTag[];
    language: string;
    summary?: string;
    translatedSubject?: string;
    translatedBody?: string;
    assigneeId?: string;
    aiDraftReply?: string;
    lastReplySource?: ReplySource;
    lastReplyAt?: string;
    conversationId?: string;
    outlookMessageId?: string;
    source: TicketSource;
    createdAt: string;
    updatedAt: string;
}

export interface Message {
    id: string;
    ticketId: string;
    direction: "inbound" | "outbound";
    body: string;
    htmlBody?: string;
    translatedBody?: string;
    from: string;
    to?: string;
    outlookMessageId?: string;
    timestamp: string;
}

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
}

export interface SentryError {
    title: string;
    count: number;
    lastSeen: string;
    url: string;
    level: "error" | "warning" | "info";
}

export interface PosthogSession {
    sessionId: string;
    url: string;
    duration: number;
    timestamp: string;
    pageCount: number;
}

export interface UserData {
    userId: string;
    email: string;
    name?: string;
    plan: "free" | "premium_monthly" | "premium_yearly";
    signupDate: string;
    lastActive: string;
    ticketCount: number;
    country?: string;
}

export interface EnrichmentData {
    sentryErrors: SentryError[];
    posthogSessions: PosthogSession[];
    userData?: UserData;
}

// ── Team ──

export const TEAM_MEMBERS: TeamMember[] = [
    { id: "max", name: "Maximilian", email: "max@studyflash.ai", role: "support" },
    { id: "alicia", name: "Alicia", email: "alicia@studyflash.ai", role: "support" },
    { id: "alessandro", name: "Alessandro", email: "alessandro@studyflash.ai", role: "engineering" },
];

// ── Mock Tickets ──

const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

export const mockTickets: Ticket[] = [
    {
        id: "t-001",
        subject: "Abo kündigen und Rückerstattung",
        from: "Anastasia Schlickeiser",
        fromEmail: "anastasia@example.com",
        status: "open",
        priority: "high",
        category: "refund_request",
        tags: ["ai_processed", "ai_draft"],
        language: "de",
        summary: "User forgot to cancel yearly subscription, requesting refund of 60 CHF. Says they didn't realize it auto-renews.",
        translatedBody: "Hello, I forgot to cancel my yearly subscription to Studyflash. I should have done it by yesterday, January 19th, 2026. Is there a possibility to cancel the subscription and get my money back? I bought the yearly subscription for 2025 and didn't think about the auto-renewal. 60 CHF for a subscription is a lot of money for me right now. Thank you. Kind regards, Anastasia Schlickeiser",
        assigneeId: "alicia",
        aiDraftReply: "Hallo Anastasia,\n\nvielen Dank für deine Nachricht. Es tut mir leid zu hören, dass die automatische Verlängerung unerwartet kam.\n\nIch habe dein Abonnement sofort gekündigt und werde die Rückerstattung von 60 CHF in die Wege leiten. Du solltest den Betrag innerhalb von 5-10 Werktagen zurück auf dein Zahlungsmittel erhalten.\n\nFalls du noch Fragen hast, melde dich gerne!\n\nBeste Grüsse\nAlicia",
        source: "email",
        createdAt: h(2),
        updatedAt: h(1.5),
    },
    {
        id: "t-002",
        subject: "Je veux arrêter mon abonnement",
        from: "Audrey Megank",
        fromEmail: "audrey.megank@example.com",
        status: "open",
        priority: "medium",
        category: "subscription_cancellation",
        tags: ["ai_processed", "ai_draft"],
        language: "fr",
        summary: "User wants to cancel subscription. Replied to a Stripe receipt email with cancellation request.",
        translatedBody: "Hello, I want to stop my subscription. Yours sincerely, Audrey Megank",
        assigneeId: undefined,
        aiDraftReply: "Bonjour Audrey,\n\nMerci pour votre message. J'ai bien pris note de votre demande d'annulation.\n\nJe viens d'annuler votre abonnement avec effet immédiat. Vous ne serez plus facturée à l'avenir.\n\nSi vous avez d'autres questions, n'hésitez pas à nous contacter.\n\nCordialement,\nL'équipe Studyflash",
        source: "email",
        createdAt: h(5),
        updatedAt: h(4),
    },
    {
        id: "t-003",
        subject: "Contestazione formale addebito rinnovo",
        from: "Gaia Pistone",
        fromEmail: "gaia.pistone@example.com",
        status: "in_progress",
        priority: "critical",
        category: "billing_invoice",
        tags: ["ai_processed", "ai_draft"],
        language: "it",
        summary: "Formal billing dispute with legal threat. User claims they did not intend to renew and requests immediate cancellation, full refund, and written confirmation within 14 days — threatens PayPal dispute.",
        translatedBody: "Dear Studyflash, I formally dispute the charge for the automatic renewal of the annual subscription charged on 26/01/2026. I did not intend to renew the subscription and believed I had correctly deactivated the automatic renewal. I also did not receive any clear and explicit advance notice informing me of the upcoming automatic renewal. I formally request: 1) immediate cancellation; 2) full refund; 3) written confirmation. Without a positive response within 14 days, I will initiate PayPal dispute procedures.",
        assigneeId: "max",
        aiDraftReply: "Gentile Gaia,\n\nLa ringraziamo per la sua comunicazione. Comprendiamo la sua frustrazione e prendiamo molto seriamente la sua contestazione.\n\nAbbiamo provveduto immediatamente a:\n1. Annullare il rinnovo automatico del suo abbonamento\n2. Avviare la procedura di rimborso integrale dell'importo addebitato\n\nIl rimborso sarà visibile sul suo conto PayPal entro 5-10 giorni lavorativi.\n\nLe confermiamo che non verranno effettuati ulteriori addebiti sul suo account.\n\nRimaniamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti,\nIl team Studyflash",
        source: "email",
        createdAt: h(8),
        updatedAt: h(4),
    },
    {
        id: "t-004",
        subject: "Reihenfolge Karteikarten - Lernmodus Problem",
        from: "Laura Meier",
        fromEmail: "laura.meier@example.com",
        status: "open",
        priority: "medium",
        category: "flashcard_issues",
        tags: ["ai_processed", "ai_draft"],
        language: "de",
        summary: "User reports flashcard ordering issue — all 25 cards must be completed before any failed cards can be retried. Requests a 'practice' mode before the learning mode.",
        translatedBody: "When I have 25 flashcards, all 25 cards must first be gone through before the cards I wanted to repeat are shown again. This is completely useless for learning — having to go through 25 cards before repeating the ones I struggled with. There should be a category where you can 'practice' your cards before learning.",
        assigneeId: undefined,
        aiDraftReply: "Hallo Laura,\n\nvielen Dank für dein Feedback! Wir verstehen, dass die aktuelle Reihenfolge beim Lernen nicht optimal ist.\n\nDein Vorschlag für einen separaten Übungsmodus ist super – wir haben das bereits auf unserer Roadmap und arbeiten an einer verbesserten Lernlogik, die fehlgeschlagene Karten früher wiederholt.\n\nIch leite dein Feedback an unser Produktteam weiter, damit dein Anwendungsfall berücksichtigt wird.\n\nBeste Grüsse\nAlicia",
        source: "mobile",
        createdAt: h(12),
        updatedAt: h(11),
    },
    {
        id: "t-005",
        subject: "Cannot log in - subscription cancellation",
        from: "Fienne Speets",
        fromEmail: "fienne.speets@example.com",
        status: "waiting",
        priority: "medium",
        category: "account_issues",
        tags: ["ai_processed", "ai_draft"],
        language: "en",
        summary: "User unable to log in despite multiple attempts. Requesting subscription cancellation due to inability to use the service.",
        assigneeId: "alicia",
        aiDraftReply: "Hi Fienne,\n\nThank you for reaching out. I'm sorry to hear you're having trouble logging in.\n\nCould you let me know which email address you used to sign up? I'll check your account status right away.\n\nIf you signed up through Apple/App Store, you would need to manage your subscription directly through Apple, as we don't have access to those subscriptions.\n\nLooking forward to helping you resolve this!\n\nBest regards,\nAlicia",
        source: "email",
        createdAt: h(24),
        updatedAt: h(20),
    },
    {
        id: "t-006",
        subject: "Abo vergessen zu kündigen",
        from: "Johann Gaube",
        fromEmail: "johann.gaube@example.com",
        status: "open",
        priority: "medium",
        category: "refund_request",
        tags: ["ai_processed", "ai_draft"],
        language: "de",
        summary: "User forgot to cancel subscription, hasn't used platform for months. Provides invoice number and payment method (PayPal). Requests refund.",
        translatedBody: "Hello dear Studyflash team, I forgot to cancel my subscription since I haven't used the platform for several months. Receipt number 2774-8094, Invoice number UQFIPMCC-0002, Payment method: PayPal. Would it be possible to get a refund? You can check my activity history.",
        assigneeId: undefined,
        aiDraftReply: "Hallo Johann,\n\nvielen Dank für deine Nachricht. Ich habe überprüft und kann bestätigen, dass auf deinem Konto seit mehreren Monaten keine Aktivität stattgefunden hat.\n\nIch habe dein Abonnement sofort gekündigt und den Rückerstattungsprozess eingeleitet. Der Betrag wird innerhalb von 5-10 Werktagen auf dein PayPal-Konto zurückerstattet.\n\nBeste Grüsse\nAlicia",
        source: "email",
        createdAt: h(28),
        updatedAt: h(27),
    },
    {
        id: "t-007",
        subject: "Abo-Abschluss unter falschem E-Mail-Konto",
        from: "Marie Weber",
        fromEmail: "marie.weber@example.com",
        status: "in_progress",
        priority: "high",
        category: "account_issues",
        tags: ["ai_processed", "ai_draft"],
        language: "de",
        summary: "User says subscription is under a different email than expected. Provides screenshot proof that subscription runs until 22.10.26.",
        translatedBody: "Hello, so I signed up using this email address. In the attached photo you can see that the subscription doesn't expire until 22.10.26.\n\n[Previous reply from Maximilian asking which email was used and mentioning Apple subscriptions]",
        assigneeId: "max",
        aiDraftReply: "Hallo Marie,\n\nvielen Dank für den Screenshot! Ich kann jetzt sehen, dass dein Abo unter dieser E-Mail-Adresse läuft.\n\nIch habe dein Konto gefunden und die Daten aktualisiert. Kannst du bitte einmal versuchen, dich erneut einzuloggen?\n\nFalls es nicht klappt, schick mir bitte kurz eine Nachricht und ich schaue mir das genauer an.\n\nBeste Grüsse\nMaximilian",
        source: "email",
        createdAt: h(36),
        updatedAt: h(30),
    },
    {
        id: "t-008",
        subject: "Quiz non disponible",
        from: "Claire Dupont",
        fromEmail: "claire.dupont@example.com",
        status: "open",
        priority: "medium",
        category: "quiz_issues",
        tags: ["ai_processed", "ai_draft"],
        language: "fr",
        summary: "User cannot access a quiz they previously created but haven't reviewed yet.",
        translatedBody: "Why can't I take a quiz that I had already created? I wanted to take a quiz I had created but hadn't reviewed yet, but I can't do it.",
        assigneeId: undefined,
        aiDraftReply: "Bonjour Claire,\n\nMerci pour votre message. Je comprends que vous n'arrivez pas à accéder à votre quiz.\n\nPourriez-vous me donner plus de détails ?\n- Le nom du quiz que vous avez créé\n- Est-ce que vous recevez un message d'erreur ?\n- Utilisez-vous l'application mobile ou le site web ?\n\nCes informations m'aideront à identifier le problème rapidement.\n\nCordialement,\nAlicia",
        source: "mobile",
        createdAt: h(40),
        updatedAt: h(39),
    },
    {
        id: "t-009",
        subject: "Kein Kurs erstellbar",
        from: "Tim Becker",
        fromEmail: "tim.becker@example.com",
        status: "closed",
        priority: "low",
        category: "misunderstanding",
        tags: ["ai_processed", "auto_closed"],
        language: "de",
        summary: "User frustrated about needing premium to create courses. Content is emotionally charged but not actionable — auto-closed as misunderstanding about free tier limitations.",
        translatedBody: "I press plus and then this comes up. I think it's outrageous because I thought I could finally impress my parents but no, because everything costs money...",
        assigneeId: undefined,
        source: "mobile",
        createdAt: h(48),
        updatedAt: h(47),
    },
    {
        id: "t-010",
        subject: "Samenvatting maken toetsstof",
        from: "Sophie van den Berg",
        fromEmail: "sophie.vdb@example.com",
        status: "open",
        priority: "low",
        category: "content_upload",
        tags: ["ai_processed"],
        language: "nl",
        summary: "User pasted extensive study material (textbook chapters, references) into the support form, likely trying to create a summary using the app but submitted it as a support ticket instead.",
        translatedBody: "[Extensive study material for a behavioral change exam including multiple book chapters and references]",
        assigneeId: undefined,
        aiDraftReply: "Hallo Sophie,\n\nBedankt voor je bericht! Het lijkt erop dat je je studiemateriaal per ongeluk als een support ticket hebt ingediend in plaats van het in de app te uploaden.\n\nOm een samenvatting te maken van je studiemateriaal:\n1. Open de Studyflash app\n2. Klik op '+' om een nieuw onderwerp aan te maken\n3. Upload je materiaal daar\n\nAls je hulp nodig hebt bij het uploaden, laat het me gerust weten!\n\nMet vriendelijke groeten,\nAlicia",
        source: "mobile",
        createdAt: h(52),
        updatedAt: h(51),
    },
    {
        id: "t-011",
        subject: "Flashcards werden nicht auf Deutsch erstellt",
        from: "Markus König",
        fromEmail: "markus.koenig@example.com",
        status: "open",
        priority: "medium",
        category: "language_issues",
        tags: ["ai_processed", "ai_draft"],
        language: "de",
        summary: "User reports flashcards are generated in wrong language despite setting German language in app preferences.",
        assigneeId: "alessandro",
        aiDraftReply: "Hallo Markus,\n\nvielen Dank für die Meldung! Das klingt nach einem Bug in unserer Spracherkennung.\n\nKönntest du mir bitte folgende Infos schicken:\n- Welche Sprache wird stattdessen verwendet?\n- In welchem Format hast du das Studienmaterial hochgeladen?\n- Nutzt du die App auf dem Handy oder im Browser?\n\nDas hilft unserem Entwicklungsteam, den Fehler schneller zu finden.\n\nBeste Grüsse\nAlessandro",
        source: "mobile",
        createdAt: h(60),
        updatedAt: h(59),
    },
    {
        id: "t-012",
        subject: "Technical error when generating podcast",
        from: "Emma Fischer",
        fromEmail: "emma.fischer@example.com",
        status: "open",
        priority: "high",
        category: "technical_errors",
        tags: ["ai_processed", "ai_draft"],
        language: "en",
        summary: "User gets a 500 error when trying to generate a podcast from their uploaded notes. Happens consistently.",
        assigneeId: "alessandro",
        aiDraftReply: "Hi Emma,\n\nThank you for reporting this issue. I'm sorry about the error you're experiencing with podcast generation.\n\nI've escalated this to our engineering team and we're investigating the issue. Could you let me know:\n- What type of file did you upload? (PDF, text, etc.)\n- Approximately how large was the file?\n- When did this first start happening?\n\nWe'll get this resolved as quickly as possible.\n\nBest regards,\nAlessandro",
        source: "web",
        createdAt: h(72),
        updatedAt: h(70),
    },
    {
        id: "t-013",
        subject: "",
        from: "Unknown",
        fromEmail: "spam@example.com",
        status: "closed",
        priority: "low",
        category: "garbage",
        tags: ["ai_processed", "auto_closed"],
        language: "en",
        summary: "Empty/spam ticket — auto-closed.",
        assigneeId: undefined,
        source: "mobile",
        createdAt: h(80),
        updatedAt: h(80),
    },
    {
        id: "t-014",
        subject: "Données perdues après mise à jour",
        from: "Lucas Martin",
        fromEmail: "lucas.martin@example.com",
        status: "open",
        priority: "critical",
        category: "data_loss",
        tags: ["ai_processed", "ai_draft"],
        language: "fr",
        summary: "User reports all flashcard sets disappeared after app update. Had 200+ cards for upcoming exams.",
        assigneeId: "alessandro",
        aiDraftReply: "Bonjour Lucas,\n\nJe suis vraiment désolé d'apprendre que vos données ont disparu après la mise à jour. C'est une situation que nous prenons très au sérieux.\n\nJ'ai immédiatement transmis votre cas à notre équipe technique. Nous allons vérifier nos sauvegardes pour récupérer vos données.\n\nPouvez-vous me confirmer :\n- Quel appareil utilisez-vous (iOS/Android) ?\n- La version de l'application\n- Votre adresse email de connexion\n\nNous faisons tout notre possible pour récupérer vos flashcards.\n\nCordialement,\nAlessandro",
        source: "mobile",
        createdAt: h(3),
        updatedAt: h(2),
    },
    {
        id: "t-015",
        subject: "Mindmap-Export funktioniert nicht",
        from: "Jonas Huber",
        fromEmail: "jonas.huber@example.com",
        status: "resolved",
        priority: "medium",
        category: "mindmap_issues",
        tags: ["ai_processed", "ai_draft"],
        language: "de",
        summary: "User reports mindmap export as PDF produces blank file. Issue was fixed with latest deployment.",
        assigneeId: "alessandro",
        source: "web",
        createdAt: h(96),
        updatedAt: h(48),
    },
];

// ── Mock Messages ──

export const mockMessages: Record<string, Message[]> = {
    "t-001": [
        {
            id: "m-001-1",
            ticketId: "t-001",
            direction: "inbound",
            body: "Guten Tag\nIch habe vergessen mein Jahresabo von Studyflash zu kündigen. Ich hätte es bis gestern den 19.01.2026 machen müssen. Gibt es eine Möglichkeit das Abo zu kündigen und mein Geld wieder zurückzubekommen?\nIch hatte das Jahresabo für 2025 gekaut und hab nicht daran gedacht, dass es sich automatisch verlängert.\n60 CHF für ein Abo sind gerade viel Geld für mich.\nVielen Dank\nFreundliche Grüsse\nAnastasia Schlickeiser",
            from: "Anastasia Schlickeiser",
            timestamp: h(2),
        },
    ],
    "t-003": [
        {
            id: "m-003-1",
            ticketId: "t-003",
            direction: "inbound",
            body: "Spett.le Studyflash,\ncon la presente intendo contestare formalmente l'addebito relativo al rinnovo automatico dell'abbonamento annuale a mio carico, avvenuto in data 26/01/2026.\nPreciso che non era mia intenzione rinnovare l'abbonamento e che ritenevo di aver correttamente disattivato il rinnovo automatico.\nAlla luce di quanto sopra, richiedo formalmente:\n1. l'annullamento immediato del rinnovo automatico dell'abbonamento;\n2. il rimborso integrale dell'importo addebitato;\n3. conferma scritta dell'avvenuta cancellazione.\nIn mancanza di un riscontro positivo entro 14 giorni, mi vedrò costretto ad attivare le procedure di contestazione tramite PayPal.\nCordiali saluti,\nGaia Pistone\nnumero ricevuta 2426-9559",
            from: "Gaia Pistone",
            timestamp: h(8),
        },
        {
            id: "m-003-2",
            ticketId: "t-003",
            direction: "outbound",
            body: "Gentile Gaia,\n\nLa ringraziamo per la sua comunicazione. Comprendiamo perfettamente la situazione e ci scusiamo per l'inconveniente.\n\nAbbiamo provveduto immediatamente a:\n1. Annullare il rinnovo automatico\n2. Avviare la procedura di rimborso integrale\n\nIl rimborso sarà visibile sul suo conto PayPal entro 5-10 giorni lavorativi.\n\nCordiali saluti,\nMaximilian\nStudyflash Support",
            from: "Maximilian",
            to: "gaia.pistone@example.com",
            timestamp: h(6),
        },
        {
            id: "m-003-3",
            ticketId: "t-003",
            direction: "inbound",
            body: "Gentile Maximilian,\n\nLa ringrazio per la celere risposta e per aver provveduto alla cancellazione e al rimborso.\n\nAttendo conferma dell'avvenuto accredito.\n\nCordiali saluti,\nGaia Pistone",
            from: "Gaia Pistone",
            timestamp: h(5),
        },
    ],
    "t-005": [
        {
            id: "m-005-1",
            ticketId: "t-005",
            direction: "inbound",
            body: "Dear Sir/Madam,\nI would like to cancel my subscription with StudyFlash.\nThe reason for this request is that I am unable to log in to my account and therefore cannot use the service. Despite multiple attempts, I have not been able to access my account.\nI kindly ask you to cancel my subscription with immediate effect and to confirm this cancellation by email.\nThank you in advance for your assistance.\nKind regards,\nFienne Speets",
            from: "Fienne Speets",
            timestamp: h(24),
        },
        {
            id: "m-005-2",
            ticketId: "t-005",
            direction: "outbound",
            body: "Hi Fienne,\n\nThank you for reaching out. I'm sorry to hear you're having trouble logging in.\n\nCould you let me know which email address you used to sign up? I'll check your account status.\n\nIf you signed up through Apple/App Store, you would need to manage your subscription directly through Apple.\n\nBest regards,\nAlicia",
            from: "Alicia",
            to: "fienne.speets@example.com",
            timestamp: h(22),
        },
    ],
    "t-007": [
        {
            id: "m-007-1",
            ticketId: "t-007",
            direction: "inbound",
            body: "Hallo,\nIch habe ein Abo unter einer anderen E-Mail-Adresse abgeschlossen und kann mich nicht einloggen.",
            from: "Marie Weber",
            timestamp: h(40),
        },
        {
            id: "m-007-2",
            ticketId: "t-007",
            direction: "outbound",
            body: "Hi Marie,\n\nDanke für deine Nachricht. Aktuell können wir unter dieser E-Mail-Adresse kein aktives Abonnement finden.\n\nFalls du dein Abo über Apple / den App Store abgeschlossen hast, müsstest du dich bitte direkt an Apple wenden.\n\nSolltest du das Abo nicht über Apple abgeschlossen haben, gib uns bitte kurz Bescheid, über welche E-Mail-Adresse dein Konto läuft.\n\nBeste Grüsse\nMaximilian",
            from: "Maximilian",
            to: "marie.weber@example.com",
            timestamp: h(38),
        },
        {
            id: "m-007-3",
            ticketId: "t-007",
            direction: "inbound",
            body: "Hallo,\nAlso ich habe mich über diese Email-Adresse angemeldet.\nAuf dem Foto im Anhang sieht man auch, dass das Abo erst am 22.10.26 abläuft.",
            from: "Marie Weber",
            timestamp: h(36),
        },
    ],
};

// ── Mock Enrichment ──

export const mockEnrichment: Record<string, EnrichmentData> = {
    "t-001": {
        sentryErrors: [],
        posthogSessions: [
            {
                sessionId: "ph-001",
                url: "https://app.posthog.com/recordings/ph-001",
                duration: 45,
                timestamp: h(3),
                pageCount: 2,
            },
        ],
        userData: {
            userId: "usr-anastasia",
            email: "anastasia@example.com",
            name: "Anastasia Schlickeiser",
            plan: "premium_yearly",
            signupDate: new Date("2025-01-19").toISOString(),
            lastActive: h(48),
            ticketCount: 1,
            country: "CH",
        },
    },
    "t-003": {
        sentryErrors: [],
        posthogSessions: [],
        userData: {
            userId: "usr-gaia",
            email: "gaia.pistone@example.com",
            name: "Gaia Pistone",
            plan: "premium_yearly",
            signupDate: new Date("2025-01-26").toISOString(),
            lastActive: h(240),
            ticketCount: 1,
            country: "IT",
        },
    },
    "t-012": {
        sentryErrors: [
            {
                title: "Error 500: PodcastGenerationService.generate() failed",
                count: 47,
                lastSeen: h(1),
                url: "https://sentry.io/studyflash/issue/98765",
                level: "error",
            },
            {
                title: "TimeoutError: Bedrock API response exceeded 30s",
                count: 12,
                lastSeen: h(3),
                url: "https://sentry.io/studyflash/issue/98766",
                level: "warning",
            },
        ],
        posthogSessions: [
            {
                sessionId: "ph-012",
                url: "https://app.posthog.com/recordings/ph-012",
                duration: 180,
                timestamp: h(2),
                pageCount: 5,
            },
        ],
        userData: {
            userId: "usr-emma",
            email: "emma.fischer@example.com",
            name: "Emma Fischer",
            plan: "premium_monthly",
            signupDate: new Date("2025-09-15").toISOString(),
            lastActive: h(1),
            ticketCount: 3,
            country: "DE",
        },
    },
    "t-014": {
        sentryErrors: [
            {
                title: "DataSyncError: Local DB migration failed on v3.2.1",
                count: 234,
                lastSeen: h(1),
                url: "https://sentry.io/studyflash/issue/99001",
                level: "error",
            },
        ],
        posthogSessions: [],
        userData: {
            userId: "usr-lucas",
            email: "lucas.martin@example.com",
            name: "Lucas Martin",
            plan: "premium_yearly",
            signupDate: new Date("2025-06-01").toISOString(),
            lastActive: h(4),
            ticketCount: 1,
            country: "FR",
        },
    },
};
