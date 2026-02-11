# Anleitung: Projekt mit Git auf ein anderes Gerät übertragen

Da Git auf deinem Computer nochn nicht installiert ist, musst du es zuerst einrichten. Hier ist eine Schritt-für-Schritt-Anleitung.

## 1. Git installieren (Aktueller PC)
1.  Lade **Git for Windows** herunter: [https://git-scm.com/download/win](https://git-scm.com/download/win)
2.  Installiere es (einfach immer auf "Next" klicken, die Standardeinstellungen sind okay).
3.  Öffne nach der Installation ein **neues** Terminal (Eingabeaufforderung oder PowerShell), damit der Befehl `git` erkannt wird.

## 2. Git konfigurieren
Gib folgende Befehle in dein Terminal ein (ersetze die Namen mit deinen):

```powershell
git config --global user.name "Dein Name"
git config --global user.email "deine.email@beispiel.de"
```

## 3. Repository erstellen
Gehe in dein Projektverzeichnis (`c:\Users\Anwender\Desktop\MelodyGraph_Musikempfehlung`) und führe folgende Befehle aus:

```powershell
# 1. Repository initialisieren
git init

# 2. Alle Dateien hinzufügen (außer die in .gitignore)
git add .

# 3. Ersten Stand speichern
git commit -m "Mein Projekt Startstand"
```

## 4. Auf GitHub hochladen
1.  Erstelle einen Account auf [GitHub.com](https://github.com) (falls du noch keinen hast).
2.  Erstelle ein **neues Repository** (Feld "Repository name" ausfüllen, z.B. `music-graph`, und auf "Create repository" klicken).
3.  Kopiere den Befehl, der unter **"…or push an existing repository from the command line"** steht. Er sieht ungefähr so aus:

```powershell
git remote add origin https://github.com/DEIN_USERNAME/music-graph.git
git branch -M main
git push -u origin main
```

Führe diese Befehle in deinem Terminal aus.

## 5. Auf dem NEUEN Gerät einrichten
1.  Installiere auch dort **Git** und **Node.js**.
2.  Öffne ein Terminal und lade das Projekt herunter:

```powershell
git clone https://github.com/DEIN_USERNAME/music-graph.git
cd music-graph
```

3.  Installiere die Abhängigkeiten (Frontend & Backend):

```powershell
# Backend installieren
cd backend
npm install

# Frontend installieren
cd ../frontend
npm install
```

## ⚠️ WICHTIG: Die .env Dateien
Die Dateien mit Passwörtern (`.env`) werden **NICHT** mit hochgeladen (aus Sicherheitsgründen).
Du musst die `.env` Dateien **manuell** vom alten auf den neuen PC kopieren (z.B. per USB-Stick oder sicherem Messenger).

*   Kopiere `backend/.env` nach `music-graph/backend/.env` auf dem neuen PC.

## 6. Starten
Auf dem neuen PC:
1.  Datenbanken (MongoDB / Neo4j) müssen erreichbar sein (ggf. Connection-Strings in `.env` anpassen oder Docker starten).
2.  Starten wie gewohnt: `npm run dev` (Backend) und `npm start` (Frontend).
