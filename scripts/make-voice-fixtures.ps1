# Génère les enregistrements de test de la reconnaissance vocale (tests/fixtures/voice).
# Synthèse vocale de Windows ; ces fichiers servent aux tests et ne sont pas livrés dans le jeu.
Add-Type -AssemblyName System.Speech
$out = Join-Path $PSScriptRoot '..\tests\fixtures\voice'
New-Item -ItemType Directory -Force $out | Out-Null
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$words = @{ assis = 'Assis'; couche = 'Couché'; patte = 'La patte'; tourne = 'Tourne'; debout = 'Debout'; nom = 'Noisette'; inconnu = 'Bonjour' }
# Voix et débits : la voix française sert de « joueur », les autres d'accents différents.
$takes = @(
  @{ voice = 'Microsoft Hortense Desktop'; rate = 0; tag = 'h0' },
  @{ voice = 'Microsoft Hortense Desktop'; rate = -2; tag = 'hm2' },
  @{ voice = 'Microsoft Hortense Desktop'; rate = 2; tag = 'hp2' },
  @{ voice = 'Microsoft Hortense Desktop'; rate = -1; tag = 'hm1' },
  @{ voice = 'Microsoft Hortense Desktop'; rate = 1; tag = 'hp1' },
  @{ voice = 'Microsoft Hortense Desktop'; rate = 3; tag = 'hp3' },
  @{ voice = 'Microsoft Hortense Desktop'; rate = -3; tag = 'hm3' }
)
foreach ($k in $words.Keys) {
  foreach ($t in $takes) {
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $s.SelectVoice($t.voice)
    $s.Rate = $t.rate
    $file = Join-Path $out "$k-$($t.tag).wav"
    $s.SetOutputToWaveFile($file, $fmt)
    $s.Speak($words[$k])
    $s.Dispose()
  }
}
Get-ChildItem $out | Measure-Object -Property Length -Sum | ForEach-Object { "$($_.Count) fichiers, $([math]::Round($_.Sum / 1KB)) Ko" }
