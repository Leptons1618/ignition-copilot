import random

base = "[default]DemoPlant/MotorM12/"

paths = [
    base+"SimulatorEnabled",
    base+"SimState",
    base+"SimTime",
    base+"Temperature",
    base+"LoadPercent",
    base+"FanCurrent",
    base+"Running",
    base+"ResetAlarm"
]

vals = system.tag.readBlocking(paths)

enabled   = vals[0].value
state     = vals[1].value
simTime   = vals[2].value
temp      = vals[3].value
load      = vals[4].value
fan       = vals[5].value
running   = vals[6].value
resetCmd  = vals[7].value


# ---------------------------
# RESET LOGIC
# ---------------------------
if resetCmd:
    system.tag.writeBlocking(
        [
            base+"Temperature",
            base+"LoadPercent",
            base+"FanCurrent",
            base+"Running",
            base+"SimState",
            base+"SimTime",
            base+"FaultReason",
            base+"ResetAlarm"
        ],
        [
            45.0,
            40.0,
            8.5,
            True,
            "NORMAL",
            0,
            "",
            False
        ]
    )
    return


# ---------------------------
# SIMULATOR OFF
# ---------------------------
if not enabled:
    return


# increment simulation time
simTime += 1


# ---------------------------
# STATE MACHINE
# ---------------------------

if state == "NORMAL":

    load += random.uniform(-0.3, 0.3)
    temp += load * 0.01

    if simTime > 20:
        state = "FAN_FAIL"


elif state == "FAN_FAIL":

    fan -= 0.05
    load += 0.2
    temp += 0.15

    if simTime > 40:
        state = "OVERHEAT"


elif state == "OVERHEAT":

    temp += 0.35
    load += 0.1

    if temp > 85:
        state = "TRIP"


elif state == "TRIP":

    running = False
    system.tag.writeBlocking(
        [base+"FaultReason"],
        ["Cooling failure caused overheating"]
    )


# clamp values
fan = max(0, fan)
temp = max(25, temp)


# ---------------------------
# WRITE BACK
# ---------------------------
system.tag.writeBlocking(
    [
        base+"Temperature",
        base+"LoadPercent",
        base+"FanCurrent",
        base+"Running",
        base+"SimState",
        base+"SimTime"
    ],
    [
        temp,
        load,
        fan,
        running,
        state,
        simTime
    ]
)
