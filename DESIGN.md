# SurveyAnnotate Designsystem

## Designrichtung

SurveyAnnotate ist ein ruhiges, präzises Forschungs-Dashboard. Die visuelle Referenz ist ein helles SaaS-Produkt mit linker Navigation, großen aber nüchternen Kennzahlen, weichen Karten, violettem Akzent und viel Weißraum. Die Oberfläche soll vertrauenswürdig und administrierbar wirken, nicht verspielt oder akademisch trocken.

Physische Szene: Die Studienleitung arbeitet tagsüber an einem Laptop in einem hellen Büro und prüft konzentriert, ob die Studie vor dem Versand der Links valide ist. Teilnehmende bearbeiten die Umfrage in einem Browser, wahrscheinlich auf Laptop oder Tablet, mit möglichst wenig Ablenkung.

Farbstrategie: Restrained. Neutrale Flächen tragen die UI; Violett markiert Auswahl, Primäraktionen, Fortschritt und Analysewerte.

Referenzen:
- Screenshot: SurveyAnnotate Agreement Dashboard.
- Linear: klare Seitenstruktur, ruhige Navigation, präzise Dichte.
- Stripe Dashboard: saubere Formulare, statusorientierte Tabellen, dezente Elevation.

## Farbtokens

Alle neuen CSS-Farben sollten als OKLCH definiert werden.

- `--background`: `oklch(0.985 0.004 274)` für die App-Fläche.
- `--surface`: `oklch(0.998 0.003 274)` für Hauptkarten.
- `--surface-muted`: `oklch(0.965 0.012 274)` für Sidebars, Pills und leise Panels.
- `--border`: `oklch(0.89 0.015 274)` für Karten- und Eingabekanten.
- `--border-strong`: `oklch(0.78 0.035 274)` für aktive Zustände.
- `--text`: `oklch(0.19 0.035 274)` für primäre Inhalte.
- `--muted`: `oklch(0.47 0.04 274)` für Metadaten.
- `--faint`: `oklch(0.66 0.035 274)` für Hilfstext.
- `--accent`: `oklch(0.57 0.22 279)` als primäres Violett.
- `--accent-strong`: `oklch(0.49 0.24 279)` für Hover und Diagramme.
- `--accent-soft`: `oklch(0.93 0.055 279)` für aktive Navigation, Icon-Kacheln und Statusflächen.
- `--success`: `oklch(0.61 0.16 152)`.
- `--warning`: `oklch(0.72 0.14 78)`.
- `--danger`: `oklch(0.58 0.19 27)`.

## Typografie

- Schriftfamilie: `Aptos`, `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `sans-serif`.
- Keine Display-Schrift.
- Keine fluiden Schriftgrößen.
- H1: 32px, 750, line-height 1.1.
- H2: 22px, 720, line-height 1.2.
- H3: 17px, 700, line-height 1.3.
- Body: 14px bis 15px, 500, line-height 1.55.
- Tabellen, Labels, Metadaten: 12px bis 13px, 600.
- Zahlen in Metriken: 34px bis 42px, 780, tabular-nums.

## Layout

- Desktop-App mit fixer linker Sidebar von 280px und scrollbarem Hauptbereich.
- Hauptbereich maximal 1480px, linksbündig, mit 28px bis 36px Abstand.
- Kartenradius 14px für große Panels, 12px für Controls, 10px für kleine Kacheln.
- Karten haben 1px Border und sehr leichte Schatten; keine verschachtelten Karten.
- Dashboard-Kennzahlen stehen in einer responsiven Viererspalte.
- Analysepanels nutzen zwei Spalten auf Desktop und eine Spalte unter 1100px.
- Participant-Surface nutzt ein zweispaltiges Layout: links Aufgaben/Progress, rechts Bewertung; unter 900px wird es ein vertikaler Flow.

## Komponenten

### Sidebar

- Logo links oben mit kleiner violetter Icon-Kachel.
- Nav-Items mit Icon, Label, 44px Höhe, 12px Radius.
- Aktiver Zustand: `accent-soft` Hintergrund, violetter Text, leichtes Inset-Glühen.
- Unten Admin-Status mit Kreisavatar.

### Karten

- Weißliche Oberfläche, 1px Border, Schatten `0 18px 45px rgba(44, 35, 75, 0.08)`.
- Innenabstand 22px bis 28px, abhängig von Informationsdichte.
- Kopfzeilen verwenden Icon + Titel oder Titel + sekundäre Aktion.

### Buttons

- Primär: violetter Hintergrund, weiß getönter Text, 40px Höhe.
- Sekundär: Oberfläche, Border, dunkler Text.
- Ghost: nur für Navigations- oder Tabellenaktionen.
- Fokuszustand immer mit 3px violettem Ring.

### Formulare

- Labels oberhalb der Felder, 13px, semibold.
- Inputs 42px Höhe, 12px Radius, Border.
- Textareas mindestens 140px, Essays/Feedback länger.
- Fehler direkt unter dem Feld in Rot, kurz und handlungsorientiert.

### Likert-Skala

- Sieben Optionen als stabile segmentierte Auswahl.
- Jede Option zeigt Zahl und festes Kriterienlabel.
- Auf Desktop in einer Zeile, auf Mobile als zweispaltiges Grid mit ausreichend Touch-Fläche.
- Antwortänderungen zeigen einen kurzen gespeicherten Zustand, aber keinen Speichern-Button.

### Tabellen

- Dichte Listen mit 48px bis 56px Zeilenhöhe.
- Status-Pills für `Entwurf`, `Aktiv`, `Geschlossen`, `Begonnen`, `Abgeschlossen`.
- Lange Inhalte werden nicht in Tabellen ausgegeben, sondern in Detailbereichen.

## Participant UI

- Zwischen Essays gibt es einen Leseschritt: Schreibauftrag eingeklappt oben, Essay sichtbar im Hauptbereich.
- Beim Bewerten sind Schreibauftrag und Essay oben als eingeklappte Kontextpanels verfügbar.
- Fortschritt bleibt sichtbar: Gesamtfortschritt, Essays erledigt, aktuelle Feedbackposition.
- Ein Übersichtsschirm erlaubt direkte Navigation zu offenen und erledigten Aufgaben.
- Pro Schritt wird genau ein Feedbacktext mit allen Likert-Fragen bewertet.
- Abschlussbutton bleibt deaktiviert, bis Demografie und alle Ratings vollständig sind.
- Nach Abschluss erscheint eine ruhige Bestätigungsseite ohne Bearbeitungszugang.

## Admin UI

- Dashboard zeigt Studie, Validierungsstatus, Gruppen, Teilnehmende, Essays, Antworten und Agreement.
- Importansicht dokumentiert die erwarteten CSV-Spalten direkt neben den Uploadfeldern.
- Bewertungsfragen sind fest hinterlegt und werden nicht im Adminbereich konfiguriert.
- Materialansicht zeigt Themen, Essays, Feedbackmethoden und Reihenfolge.
- Linkansicht zeigt echte Vornamen nur zur Verteilung; Export der Antworten bleibt pseudonym.
- Ergebnisse zeigen Fortschritt, Mittelwerte und ordinales Krippendorffs Alpha.

## Zustände

- Empty: konkrete nächste Aktion, etwa CSV importieren oder Fragen anlegen.
- Loading: Skeleton-Zeilen und Skeleton-Karten statt zentralem Spinner.
- Error: kurze Meldung mit Korrekturhinweis.
- Draft validation: blockierende Fehler als Liste mit direktem Bezug auf Datenstruktur.
- Success: dezente grüne Statusfläche oder Toast, keine Modal-Inflation.

## Motion

- 160ms bis 220ms, ease-out.
- Hover hebt Karten minimal an, keine Layoutverschiebung.
- Collapsible Panels animieren Opacity und Grid-Template/Max-Height sparsam.
- `prefers-reduced-motion` respektieren.

## Barrierefreiheit

- Alle Inputs haben Labels.
- Buttons haben sichtbare Fokuszustände.
- Farbkontrast mindestens WCAG AA.
- Participant-Navigation ist per Tastatur erreichbar.
- Statusänderungen beim Autosave werden per `aria-live` angekündigt.

## Anti-Patterns

- Keine dunkle Analytics-Ästhetik.
- Keine Gradient-Typografie.
- Keine Glasflächen als Deko.
- Keine verschachtelten Karten.
- Keine Hero-Landingpage; die App startet direkt in der Aufgabe oder im Dashboard.
