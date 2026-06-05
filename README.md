# SurveyAnnotate

Ein einmaliges Next.js + Convex Werkzeug für eine Likert-Studie zu Essay-Feedback.

## Setup

```bash
npm install
npx convex dev
```

Convex legt beim ersten Start ein Projekt an und gibt eine URL aus. Lege danach `.env.local` an:

```bash
NEXT_PUBLIC_CONVEX_URL=https://dein-projekt.convex.cloud
ADMIN_PASSWORD=ein-langes-passwort
```

In Convex muss dasselbe Passwort als Environment Variable gesetzt werden:

```bash
npx convex env set ADMIN_PASSWORD ein-langes-passwort
```

Optional: Für E-Mail-Benachrichtigungen bei Start und Abschluss eines Surveys setze Resend-Zugangsdaten in Convex. Ohne diese Variablen läuft die Studie weiter, aber es werden keine E-Mails verschickt.

```bash
npx convex env set RESEND_API_KEY re_...
npx convex env set EMAIL_FROM "SurveyAnnotate <notifications@deine-domain.de>"
npx convex env set SURVEY_NOTIFICATION_EMAIL leon.biermann@gmx.net
```

Dann die Next-App starten:

```bash
npm run dev
```

Adminoberfläche: `http://localhost:3000/admin`

## Importformat Teilnehmende

Eine Zeile pro Person. Die Gruppenzuordnung machst du direkt in der CSV.

```csv
groupKey,firstName
A,Anna
A,Ben
A,Cem
B,Dana
B,Emil
B,Finn
```

Die echten Vornamen werden nur im Adminbereich und in der separaten Linkliste angezeigt. Der Antwortexport enthält nur Pseudonyme.

Eine Vorlage liegt in [sample_data/participants_template.csv](sample_data/participants_template.csv). Ersetze dort nur die `firstName`-Werte durch die echten Vornamen und behalte `groupKey` für deine manuelle Gruppierung.

## Importformat Materialien

Long-CSV: eine Zeile pro Feedbacktext eines Essays.

```csv
topicKey,topicTitle,prompt,promptImageUrl,essayKey,essayTitle,gradeLevel,essayText,methodKey,feedbackText
unfall,Unfall,"<Bildbeschreibung> ...",,essay-01,Essay 1,9,"Essaytext...",method-a,"Feedbacktext..."
unfall,Unfall,"<Bildbeschreibung> ...",,essay-01,Essay 1,9,"Essaytext...",method-b,"Feedbacktext..."
unfall,Unfall,"<Bildbeschreibung> ...",,essay-01,Essay 1,9,"Essaytext...",method-c,"Feedbacktext..."
```

`promptImageUrl` ist optional und kann für externe oder statisch ausgelieferte Bilder genutzt werden. Empfohlen ist der Upload im Adminbereich unter `Material` -> `Promptbilder`; dabei wird die Datei in Convex Storage gespeichert und dem Thema zugeordnet.

Validierungsregeln vor Aktivierung:

- genau 6 Gruppen
- genau 3 Themen
- jedes Thema hat gleich viele Essays
- jede Thema-Klassenstufe-Kombination hat gleich viele Essays
- jeder Essay hat genau 3 Feedbacktexte
- jeder Essay hat eine Klassenstufe in `gradeLevel` (`5` oder `9`)
- nach der Generierung ist jedes Thema genau 2 Gruppen zugeordnet, eine pro Klassenstufe
- die 6 festen Bewertungsfragen sind angelegt und haben jeweils genau 7 Labels

Nach dem Import klickst du in `Material` auf `Gruppen, Essays und Feedbackreihenfolge generieren`. Danach kannst du Feedbackreihenfolgen vor dem Studienstart manuell verschieben.
Falls ein Schreibauftrag ein Bild hat, lade es vorher in `Material` -> `Promptbilder` beim passenden Thema hoch.

Eine automatisch aus dem benachbarten Thesis-Code-Repository erzeugte Beispieldatei liegt in [sample_data/materials_sample.csv](sample_data/materials_sample.csv). Sie nutzt:

- `no_issues`: `reverse_engineering_student_feedback_no_issues`
- `llama_unified_v1`: `reverse_engineering_student_feedback_guided_unified_v1_v3`
- `llama_baseline_v2`: `reverse_engineering_student_feedback_baseline_v2_v3`

Die Datei enthält 6 Essays pro Thema, also nach der App-Randomisierung 3 Essays pro Gruppe.

## Importformat automatische Rankings

Im Adminbereich unter `Import` kannst du zusätzlich die automatisch erzeugte Helpfulness-Ranking-CSV importieren. Dieser Import ersetzt nur die gespeicherten automatischen Rankings; Materialien, Teilnehmende und Antworten bleiben unverändert.

Erwartete Datei:

```text
../ma_thesis_code/results/manual_annotation_study/automatic_helpfulness_rankings_for_survey.csv
```

Pflichtspalten:

- `autoApproachKey`
- `combined_rank`, `combined_ability`, `combined_score`
- `combined_wins`, `combined_losses`, `combined_ties`, `combined_comparisons`

Optionale Mapping- und Metadatenspalten:

- `surveyMethodKey`
- `displayName`
- `isCurrentManualAnnotationMethod`
- `materialFeedbackRows`
- Judge-Metriken mit den Präfixen `gemma_`, `llama_`, `openai_`
- `rankingGeneratedAt`, `rankingDescription`, `rankingSourceModels`

Zeilen mit `surveyMethodKey` werden in `Ergebnisse` gegen die Human-Ratings gematcht. Zeilen ohne `surveyMethodKey` bleiben als zusätzliche automatische Ansätze gespeichert und werden in der Importvorschau gezählt.

Unter `Ergebnisse` -> `Bradley-Terry Rankingvergleich` wird für die Human-Ratings ein explizites Ranking berechnet: pro Annotator:in und Essay wird ausschließlich die letzte Frage `gesamt_hilfreich` zur Gesamt-Hilfreichkeit verwendet, daraus werden paarweise Siege/Ties zwischen Methoden gebildet, und daraus werden Bradley-Terry-Ability-Werte geschätzt. Zusätzlich gibt es eine Essay-Ansicht mit aggregiertem Essay-Ranking und den individuellen Annotator:innen-Rankings pro Essay. Die aktuell importierte Automatic-Ranking-CSV enthält nur Overall-Methodenränge; diese Overall-Automatikränge werden deshalb als Vergleichsspalten neben Overall-, Essay- und Annotator:innen-Rankings angezeigt.

## Beispieldateien neu erzeugen

Das Skript [scripts/prepare_survey_imports.py](scripts/prepare_survey_imports.py) liest standardmäßig `../ma_thesis_code/results/llm_pipeline/catalog.sqlite` und schreibt die beiden CSV-Dateien nach `sample_data/`.

```bash
python3 scripts/prepare_survey_imports.py
```

Wichtige Optionen:

```bash
# 8 Essays pro Thema, also 4 Essays pro Gruppe und Thema
python3 scripts/prepare_survey_imports.py --essays-per-topic 8

# anderer Katalog
python3 scripts/prepare_survey_imports.py --catalog ../ma_thesis_code/results/llm_pipeline/catalog.sqlite
```

`--essays-per-topic` muss gerade sein, weil jedes Thema auf zwei Gruppen verteilt wird. Der Llama-Unified-v1-Run enthält mehrere Feedback-Snippets pro Essay; das Skript fasst diese Snippets in `feedbackText` zu einem nummerierten Feedbacktext zusammen.

## Studienablauf

1. Teilnehmende importieren.
2. Materialien importieren.
3. Zuweisungen generieren.
4. Validierungsfehler beheben.
5. Studie in `Einstellungen` aktivieren.
6. In `Links` persönliche Links kopieren oder als CSV exportieren.
7. Optional automatische Rankings importieren.
8. In `Ergebnisse` Fortschritt, Mittelwerte, Alpha, Antwort-CSV und den Vergleich `Automatik vs. Human` abrufen.

Teilnehmende sehen pro Essay zuerst einen Leseschritt mit eingeklapptem Schreibauftrag und sichtbarem Essay. Danach bewerten sie die drei Feedbacktexte; Schreibauftrag und Essay bleiben dabei oben eingeklappt verfügbar. Antworten speichern automatisch. Der Abschluss ist nur möglich, wenn Alter, Deutschkenntnisse und alle Ratings vollständig sind.

Im Adminbereich kannst du CSVs entweder in das Textfeld einfügen, per Dateiauswahl laden oder direkt auf die Drop-Zone ziehen. Geladene Dateien werden zuerst in das Textfeld übernommen, damit du sie vor dem Import noch prüfen oder korrigieren kannst.

Der Schreibauftrag kommt aus der Materialspalte `prompt`. Die Klassenstufe der Essays kommt aus `gradeLevel` und muss `5` oder `9` sein. Beim Generieren erhält jede Gruppe zufällig genau ein Thema und genau eine Klassenstufe; Gruppen bekommen nur Essays aus dieser Thema-Klassenstufe-Kombination. Das optionale Bild kann nach dem Materialimport im Adminbereich pro Thema hochgeladen werden. Das Generator-Skript füllt `prompt` aus `essays.essay_prompt` im Pipeline-Katalog und lässt `promptImageUrl` leer, damit keine lokalen Bildpfade vorausgesetzt werden. Beim Upload wird das Bild in Convex Storage gespeichert und den Teilnehmenden zusammen mit dem Essay im aufklappbaren Kontext angezeigt.

## Export

Der Antwortexport ist eine Long-CSV mit numerischen Likert-Werten:

```csv
annotatorPseudonym,annotatorCode,groupKey,topicKey,essayKey,methodKey,questionKey,value,age,germanProficiency,completed
```

Vornamen werden im Antwortexport bewusst nicht ausgegeben.

## Deployment

Empfohlen ist ein gemeinsamer Vercel-Build, der Convex-Funktionen und Next.js-Frontend zusammen deployt.

### Convex vorbereiten

1. In Convex eine Production Deployment anlegen.
2. In der Convex Production Deployment `ADMIN_PASSWORD` und optional die E-Mail-Variablen setzen:

```bash
npx convex env set --prod ADMIN_PASSWORD
npx convex env set --prod RESEND_API_KEY
npx convex env set --prod EMAIL_FROM
npx convex env set --prod SURVEY_NOTIFICATION_EMAIL
```

3. In Convex für die Production Deployment einen Production Deploy Key erzeugen.

### Vercel konfigurieren

1. Repository mit Vercel verbinden.
2. In Vercel als Environment Variable für `Production` setzen:
   - `CONVEX_DEPLOY_KEY`: Convex Production Deploy Key
3. Build Command:

```bash
npx convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --cmd 'npm run build'
```

Convex liest dabei `CONVEX_DEPLOY_KEY`, deployt Schema und Funktionen in die zugehörige Production Deployment und stellt `NEXT_PUBLIC_CONVEX_URL` für den Next.js-Build bereit. Du musst `NEXT_PUBLIC_CONVEX_URL` in Vercel nicht separat setzen, solange der Build Command oben verwendet wird.

Für Preview Deployments kannst du zusätzlich einen Convex Preview Deploy Key als `CONVEX_DEPLOY_KEY` für Vercel `Preview` setzen. Für diese einmalige Studie reicht Production meistens aus.

Nach dem Deployment im Adminbereich einloggen, Daten importieren, Studie aktivieren und Links verteilen.

## Hinweise

- Der Adminschutz ist bewusst einfach gehalten: Passwort im Browser plus Prüfung in Convex-Funktionen.
- Feedbackreihenfolgen können nach dem ersten Teilnehmerstart nicht mehr geändert werden.
- Abgeschlossene Teilnehmende sehen beim erneuten Öffnen nur die Abschlussseite.
- Agreement wird als ordinales Krippendorff-Alpha über die gespeicherten Likert-Werte berechnet.
