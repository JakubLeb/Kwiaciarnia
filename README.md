# README — Kreator Bukietów 3D

## Opis projektu

Interaktywny kreator bukietów 3D osadzony w stronie kwiaciarni **Galeria Kwiatowa u Ani** (Bydgoszcz). Użytkownik komponuje bukiet z modeli 3D kwiatów, a gotowy projekt eksportuje jako kod QR do pokazania w kwiaciarni.

Strona dostępna pod: https://www.galeriakwiatowauani.pl/

---

## Struktura projektu

```
generator/
├── index.html          # Strona główna
├── style.css           # Style
└── js/
    ├── main.js         # Inicjalizacja aplikacji + loading screen
    ├── config.js       # Konfiguracja: typy kwiatów, scena, kamera
    ├── scene.js        # Scena Three.js, oświetlenie, podłoga
    ├── camera.js       # Kontrolki kamery (mysz + dotyk)
    ├── flowers.js      # Zarządzanie kwiatami + kodowanie URL / QR
    ├── collision.js    # Algorytm do rozstawiania kwiatów
    ├── modelLoader.js  # Ładowanie i cache modeli GLB
    ├── Raycaster.js    # Raycast, zaznaczanie, gizmo 3D
    └── ui.js           # Interfejs użytkownika
```

---

## Funkcje

### Dodawanie kwiatów
- **➕** — dodaje jeden kwiat w wolne miejsce (circle packing)
- **💐** — generuje pełny bukiet z wybranego gatunku

### Edytor kwiatu (klik na kwiat)
- **Pozycja** — strzałki XYZ do przesuwania
- **Obrót** — pierścienie XYZ do obracania
- **Skala** — sześciany XYZ do skalowania
- **Zamiana** — podmiana na inny gatunek
- **Usunięcie** — usunięcie kwiatu ze sceny

### Kod QR / link
Stan bukietu kodowany jest w URL jako binarny format z opcjonalną kompresją GZIP (biblioteka pako). Kod QR można zapisać i pokazać w kwiaciarni.

---

## Dostępne gatunki

| Nazwa | Model |
|---|---|
| Róża Czerwona | `rose.glb` |
| Róża Biała | `biala_roza.glb` |
| Róża Herbaciana | `herbaciana_roza.glb` |
| Róża Różowa | `rozowa_roza.glb` |
| Róża Żółta | `zolta_roza.glb` |
| Róża Fioletowa | `fioletowa_roza.glb` |
| Tulipan | `tulipan.glb` |
| Goździk | `gozdzik.glb` |
| Eustoma | `eustoma.glb` |
| Irys | `Irys.glb` |
| Gerbera | `Gerbera.glb` |
| Chryzantema | `Chryzantema.glb` |

Modele GLB umieszczone w katalogu `generator/models/`.

---

## Technologie

- **Three.js r128** — renderowanie 3D
- **GLTFLoader** — ładowanie modeli GLB (lazy load przez skypack CDN)
- **pako 2.1** — kompresja GZIP dla URL z dużymi bukietami
- **qrcodejs** — generowanie kodu QR

---

## Algorytm rozmieszczania (collision.js)

Kwiaty rozmieszczane są metodą **circle packing** w kształcie okrągłego bukietu:

1. Centrum — pierwszy kwiat zawsze trafia w środek
2. Pierścienie koncentryczne — kolejne kwiaty wypełniają kolejne okręgi, offset kąta oparty o złoty podział (φ ≈ 0.618) dla naturalnego wyglądu
3. Fallback losowy — jeśli pierścienie są pełne, Poisson-like random sampling
4. Każdy kwiat rejestrowany jest jako okrąg z promieniem wynikającym z bounding box modelu

---

## Format URL (wersja 2)

Każdy kwiat kodowany jest binarnie:

```
[flags 1B][typeIndex 1B][x 2B][z 2B]
  + opcjonalnie: [y 2B] [rotX rotY rotZ po 2B] [scaleX scaleY scaleZ po 1B]
```

Flagi bitowe określają obecność opcjonalnych pól (`bit0` = y, `bit1` = rotacja, `bit2` = skala). Cały bufor kodowany jest w URL-safe base64 (`-` zamiast `+`, `_` zamiast `/`). Przy >10 kwiatach stosowana jest kompresja GZIP (parametr `c=`), poniżej bez kompresji (parametr `b=`).

---

## Ładowanie z URL

Aplikacja wykrywa parametry `b=` lub `c=` w URL i:
1. Parsuje jakie typy kwiatów są potrzebne
2. Preładuje **tylko te modele** (oszczędność czasu przy dużych bukietach)
3. Pozostałe modele doładowuje w tle po 1s (dostępne dla edytora)
