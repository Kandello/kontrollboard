/**
 * VORABPRUEFUNG — Wegwerf-Skript
 *
 * Dieses Skript gehoert NICHT zur eigentlichen App. Es beantwortet vor dem
 * Bau fuenf technische Fragen, deren Antworten die Architektur bestimmen.
 * Nach der Messung kann das gesamte Apps-Script-Projekt geloescht werden.
 *
 * Es liest und schreibt keine Tabelle, verarbeitet keine Schuelerdaten und
 * benoetigt keine Berechtigungen ausser dem Ausliefern einer Web-App.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Vorabpruefung')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
