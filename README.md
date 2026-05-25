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
topicKey,topicTitle,prompt,promptImageUrl,essayKey,essayTitle,essayText,methodKey,feedbackText
unfall,Unfall,"<Bildbeschreibung> ...",,essay-01,Essay 1,"Essaytext...",method-a,"Feedbacktext..."
unfall,Unfall,"<Bildbeschreibung> ...",,essay-01,Essay 1,"Essaytext...",method-b,"Feedbacktext..."
unfall,Unfall,"<Bildbeschreibung> ...",,essay-01,Essay 1,"Essaytext...",method-c,"Feedbacktext..."
```

`promptImageUrl` ist optional und kann für externe oder statisch ausgelieferte Bilder genutzt werden. Empfohlen ist der Upload im Adminbereich unter `Material` -> `Promptbilder`; dabei wird die Datei in Convex Storage gespeichert und dem Thema zugeordnet.

Validierungsregeln vor Aktivierung:

- genau 6 Gruppen
- genau 3 Themen
- jedes Thema hat gleich viele Essays
- die Essayanzahl pro Thema ist gerade
- jeder Essay hat genau 3 Feedbacktexte
- jedes Thema ist genau 2 Gruppen zugeordnet
- jede Frage hat genau 7 Labels

Nach dem Import klickst du in `Material` auf `Gruppen, Essays und Feedbackreihenfolge generieren`. Danach kannst du Feedbackreihenfolgen vor dem Studienstart manuell verschieben.
Falls ein Schreibauftrag ein Bild hat, lade es vorher in `Material` -> `Promptbilder` beim passenden Thema hoch.

Eine automatisch aus dem benachbarten Thesis-Code-Repository erzeugte Beispieldatei liegt in [sample_data/materials_sample.csv](sample_data/materials_sample.csv). Sie nutzt:

- `no_issues`: `reverse_engineering_student_feedback_no_issues`
- `llama_unified_v1`: `reverse_engineering_student_feedback_guided_unified_v1_v3`
- `llama_baseline_v2`: `reverse_engineering_student_feedback_baseline_v2_v3`

Die Datei enthält 6 Essays pro Thema, also nach der App-Randomisierung 3 Essays pro Gruppe.

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
3. Likert-Fragen und alle sieben Labels konfigurieren.
4. Zuweisungen generieren.
5. Validierungsfehler beheben.
6. Studie in `Einstellungen` aktivieren.
7. In `Links` persönliche Links kopieren oder als CSV exportieren.
8. In `Ergebnisse` Fortschritt, Mittelwerte, Alpha und Antwort-CSV abrufen.

Teilnehmende sehen Schreibauftrag, optionales Prompt-Bild und Essay als aufklappbaren Kontext, bewerten jeweils einen Feedbacktext und können über die Übersicht zu Aufgaben springen. Antworten speichern automatisch. Der Abschluss ist nur möglich, wenn Alter, Deutschkenntnisse und alle Ratings vollständig sind.

Im Adminbereich kannst du CSVs entweder in das Textfeld einfügen, per Dateiauswahl laden oder direkt auf die Drop-Zone ziehen. Geladene Dateien werden zuerst in das Textfeld übernommen, damit du sie vor dem Import noch prüfen oder korrigieren kannst.

Der Schreibauftrag kommt aus der Materialspalte `prompt`. Das optionale Bild kann nach dem Materialimport im Adminbereich pro Thema hochgeladen werden. Das Generator-Skript füllt `prompt` aus `essays.essay_prompt` im Pipeline-Katalog und lässt `promptImageUrl` leer, damit keine lokalen Bildpfade vorausgesetzt werden. Beim Upload wird das Bild in Convex Storage gespeichert und den Teilnehmenden zusammen mit dem Essay im aufklappbaren Kontext angezeigt.

## Export

Der Antwortexport ist eine Long-CSV mit numerischen Likert-Werten:

```csv
annotatorPseudonym,annotatorCode,groupKey,topicKey,essayKey,methodKey,questionKey,value,age,germanProficiency,completed
```

Vornamen werden im Antwortexport bewusst nicht ausgegeben.

## Deployment

### Convex

```bash
npx convex deploy
npx convex env set ADMIN_PASSWORD ein-langes-passwort
```

Kopiere die Production Deployment URL aus Convex.

### Vercel

1. Repository mit Vercel verbinden.
2. Environment Variables setzen:
   - `NEXT_PUBLIC_CONVEX_URL`: Convex Production URL
   - `ADMIN_PASSWORD`: dasselbe Admin-Passwort
3. Build Command: `npm run build`
4. Output: Next.js Standard

Nach dem Deployment im Adminbereich einloggen, Daten importieren, Studie aktivieren und Links verteilen.

## Hinweise

- Der Adminschutz ist bewusst einfach gehalten: Passwort im Browser plus Prüfung in Convex-Funktionen.
- Feedbackreihenfolgen können nach dem ersten Teilnehmerstart nicht mehr geändert werden.
- Abgeschlossene Teilnehmende sehen beim erneuten Öffnen nur die Abschlussseite.
- Agreement wird als ordinales Krippendorff-Alpha über die gespeicherten Likert-Werte berechnet.
