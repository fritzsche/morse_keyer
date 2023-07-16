#include <Keyboard_da_DK.h>
#include <KeyboardLayout.h>
#include <Keyboard.h>
#include <Keyboard_de_DE.h>
#include <Keyboard_fr_FR.h>
#include <Keyboard_es_ES.h>
#include <Keyboard_it_IT.h>
#include <Keyboard_sv_SE.h>

/*
  Morse Adapter
*/
/*Arduino Arduino Ke
*/
/*#include <Keyboard.h>*/

const int ditPinNo = 2;
const int dahPinNo = 3;
const unsigned long debounce = 28;

int oldDitPinVal, oldDahPinVal;
unsigned long lastDit, lastDah;



void setup() {
  // initialize digital pin LED_BUILTIN as an output.
  pinMode(LED_BUILTIN, OUTPUT);
  // initialize Pin's with build in Pullup
  pinMode(ditPinNo, INPUT_PULLUP);
  pinMode(dahPinNo, INPUT_PULLUP);
  // get initial State
  oldDitPinVal = digitalRead(ditPinNo);
  oldDahPinVal = digitalRead(dahPinNo);
  // Start Time
  lastDit = millis();
  lastDah = lastDit;
  Keyboard.begin();
}

void processPin(int pin) {

}

void loop() {
  int ditPinVal = digitalRead(ditPinNo);
  int dahPinVal = digitalRead(dahPinNo);
  unsigned long time = millis();
  if (oldDitPinVal != ditPinVal && (time - lastDit) > debounce ) {
    oldDitPinVal = ditPinVal;
    lastDit = time;
    if (ditPinVal == LOW) {
      Keyboard.press(KEY_LEFT_CTRL);
      digitalWrite(LED_BUILTIN, HIGH);
    } else {
      Keyboard.release(KEY_LEFT_CTRL);
    }
  }
  if (oldDahPinVal != dahPinVal && (time - lastDah) > debounce ) {
    oldDahPinVal = dahPinVal;
    lastDah = time;
    if (dahPinVal == LOW) {
      Keyboard.press(KEY_RIGHT_CTRL);
      digitalWrite(LED_BUILTIN, HIGH);
    } else {
      Keyboard.release(KEY_RIGHT_CTRL);
    }
  }

  if (oldDitPinVal == HIGH && oldDahPinVal == HIGH) {
    digitalWrite(LED_BUILTIN, LOW);
  }
}
