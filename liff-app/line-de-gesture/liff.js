// User service UUID: Change this to your generated service UUID
const USER_SERVICE_UUID         = 'ae8edba0-a010-44ba-bfd6-913754414ca1'; // LED, Button
// User service characteristics
const USER_CHARACTERISTIC_NOTIFY_UUID = "e90b4b4e-f18a-44f0-8691-b041c7fe57f2";
const LED_CHARACTERISTIC_UUID   = 'E9062E71-9E62-4BC6-B0D3-35CDCD9B027B';
const BTN_CHARACTERISTIC_UUID   = '62FBD229-6EDD-4D1A-B554-5C4E1BB29169';


// UI settings
let ledState = false; // true: LED on, false: LED off
let clickCount = 0;

// -------------- //
// On window load //
// -------------- //

window.onload = () => {
    initializeApp();
};

// ----------------- //
// Handler functions //
// ----------------- //

function handlerToggleLed() {
    ledState = !ledState;

    uiToggleLedButton(ledState);
    liffToggleDeviceLedState(ledState);
}

// ------------ //
// UI functions //
// ------------ //

function uiToggleLedButton(state) {
    const el = document.getElementById("btn-led-toggle");
    el.innerText = state ? "Switch LED OFF" : "Switch LED ON";

    if (state) {
      el.classList.add("led-on");
    } else {
      el.classList.remove("led-on");
    }
}

function uiCountPressButton() {
    clickCount++;

    const el = document.getElementById("click-count");
    el.innerText = clickCount;
}

function uiToggleStateButton(pressed) {
    const el = document.getElementById("btn-state");

    if (pressed) {
        el.classList.add("pressed");
        el.innerText = "Pressed";
    } else {
        el.classList.remove("pressed");
        el.innerText = "Released";
    }
}

function uiToggleDeviceConnected(connected) {
    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    elStatus.classList.remove("error");

    if (connected) {
        // Hide loading animation
        uiToggleLoadingAnimation(false);
        // Show status connected
        elStatus.classList.remove("inactive");
        elStatus.classList.add("success");
        elStatus.innerText = "Device connected";
        // Show controls
        elControls.classList.remove("hidden");
    } else {
        // Show loading animation
        uiToggleLoadingAnimation(true);
        // Show status disconnected
        elStatus.classList.remove("success");
        elStatus.classList.add("inactive");
        elStatus.innerText = "Device disconnected";
        // Hide controls
        elControls.classList.add("hidden");
    }
}

function uiToggleLoadingAnimation(isLoading) {
    const elLoading = document.getElementById("loading-animation");

    if (isLoading) {
        // Show loading animation
        elLoading.classList.remove("hidden");
    } else {
        // Hide loading animation
        elLoading.classList.add("hidden");
    }
}

function uiStatusError(message, showLoadingAnimation) {
    uiToggleLoadingAnimation(showLoadingAnimation);

    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    // Show status error
    elStatus.classList.remove("success");
    elStatus.classList.remove("inactive");
    elStatus.classList.add("error");
    elStatus.innerText = message;

    // Hide controls
    elControls.classList.add("hidden");
}

function makeErrorMsg(errorObj) {
    return "Error\n" + errorObj.code + "\n" + errorObj.message;
}

// -------------- //
// LIFF functions //
// -------------- //

function initializeApp() {
    liff.init(() => initializeLiff(), error => uiStatusError(makeErrorMsg(error), false));
}

function initializeLiff() {
    liff.initPlugins(['bluetooth']).then(() => {
        liffCheckAvailablityAndDo(() => liffRequestDevice());
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffCheckAvailablityAndDo(callbackIfAvailable) {
    // Check Bluetooth availability
    liff.bluetooth.getAvailability().then(isAvailable => {
        if (isAvailable) {
            uiToggleDeviceConnected(false);
            callbackIfAvailable();
        } else {
            uiStatusError("Bluetooth not available", true);
            setTimeout(() => liffCheckAvailablityAndDo(callbackIfAvailable), 10000);
        }
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });;
}

async function liffRequestDevice() {
    await liff.bluetooth.requestDevice().then(device => {
        liffConnectToDevice(device);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

async function toggleNotification(device) {
    if (!connectedUUIDSet.has(device.id)) {
        window.alert('Please connect to a device first');
        onScreenLog('Please connect to a device first.');
        return;
    }

    const accelerometerCharacteristic = await getCharacteristic(
        device, USER_SERVICE_UUID, USER_CHARACTERISTIC_NOTIFY_UUID);

    if (notificationUUIDSet.has(device.id)) {
        // Stop notification
        await stopNotification(accelerometerCharacteristic, notificationCallback);
        notificationUUIDSet.delete(device.id);
        getDeviceNotificationButton(device).classList.remove('btn-success');
        getDeviceNotificationButton(device).classList.add('btn-secondary');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.remove('fa-toggle-on');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.add('fa-toggle-off');
    } else {
        // Start notification
        await enableNotification(accelerometerCharacteristic, notificationCallback);
        notificationUUIDSet.add(device.id);
        getDeviceNotificationButton(device).classList.remove('btn-secondary');
        getDeviceNotificationButton(device).classList.add('btn-success');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.remove('fa-toggle-off');
        getDeviceNotificationButton(device).getElementsByClassName('fas')[0].classList.add('fa-toggle-on');
    }
}

async function refreshValues(device) {
    const accelerometerCharacteristic = await getCharacteristic(
        device, USER_SERVICE_UUID, USER_CHARACTERISTIC_NOTIFY_UUID);

    const accelerometerBuffer = await readCharacteristic(accelerometerCharacteristic).catch(e => {
        return null;
    });

    if (accelerometerBuffer !== null) {
        updateSensorValue(device, accelerometerBuffer);
    }
}

function updateSensorValue(device, buffer) {
    const sw1 = buffer.getInt16(8, true);
    const sw2 = buffer.getInt16(10, true);
    getDeviceStatusSw1(device).innerText = (sw1 == 0x0001)? "ON" : "OFF";
    getDeviceStatusSw2(device).innerText = (sw2 == 0x0001)? "ON" : "OFF";
}

async function liffConnectToDevice(device) {
    await device.gatt.connect().then(async () => {
        document.getElementById("device-name").innerText = device.name;

        // Show status connected
        uiToggleDeviceConnected(true);

        // Get service
        await device.gatt.getPrimaryService(USER_SERVICE_UUID).then(service => {
            liffGetUserService(service);
        }).catch(error => {
            uiStatusError(makeErrorMsg(error), false);
        });

        // Device disconnect callback
        const disconnectCallback = () => {
            // Show status disconnected
            uiToggleDeviceConnected(false);

            // Remove disconnect callback
            device.removeEventListener('gattserverdisconnected', disconnectCallback);

            // Reset LED state
            ledState = false;
            // Reset UI elements
            uiToggleLedButton(false);
            uiToggleStateButton(false);

            // Try to reconnect
            initializeLiff();
        };

        device.addEventListener('gattserverdisconnected', disconnectCallback);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

async function liffGetUserService(service) {
    // Button pressed state
    await service.getCharacteristic(BTN_CHARACTERISTIC_UUID).then(characteristic => {
        liffGetButtonStateCharacteristic(characteristic);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });

    // Toggle LED
    await service.getCharacteristic(LED_CHARACTERISTIC_UUID).then(characteristic => {
        window.ledCharacteristic = characteristic;

        // Switch off by default
        liffToggleDeviceLedState(false);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}


async function liffGetButtonStateCharacteristic(characteristic) {
    // Add notification hook for button state
    // (Get notified when button state changes)
    await characteristic.startNotifications().then(() => {
        characteristic.addEventListener('characteristicvaluechanged', e => {
            const val = new Uint8Array(e.target.value.buffer);
            const device = new e.target.service.device;
            const sw1 = val.getInt16(0, true);
            const sw2 = val.getInt16(2, true);
            getDeviceStatusSw1(device).innerText = (sw1 == 0x0001)? "ON" : "OFF";
            getDeviceStatusSw2(device).innerText = (sw2 == 0x0001)? "ON" : "OFF";
        });
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function getDeviceStatusSw1(device) {
    alert("SW1 pressed")
    return getDeviceCard(device).getElementsByClassName('sw1-value')[0];
}
function getDeviceStatusSw2(device) {
    alert("SW2 pressed")
    return getDeviceCard(device).getElementsByClassName('sw2-value')[0];
}

function liffToggleDeviceLedState(state) {
    // on: 0x01
    // off: 0x00
    window.ledCharacteristic.writeValue(
        state ? new Uint8Array([0x01]) : new Uint8Array([0x00])
    ).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}
