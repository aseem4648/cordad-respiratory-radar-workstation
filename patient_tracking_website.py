import cv2
import math
import numpy as np
import mediapipe as mp
import threading
from flask import Flask, Response

# -----------------------------
# Patient Body + Chest Tilt Tracking
# -----------------------------

mp_pose = mp.solutions.pose

# White/light-grey tracking
POINT_COLOR = (245, 245, 245)
LINE_COLOR = (245, 245, 245)

# Red chest center line
CHEST_COLOR = (0, 0, 255)

# ESP32-CAM
STREAM_URL = "http://172.20.10.6:81/stream"

cap = cv2.VideoCapture(STREAM_URL, cv2.CAP_FFMPEG)

# Reduce camera buffering where supported
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("Camera could not be opened.")
    exit()

# ============================================================
# WEBSITE LIVE TRACKING STREAM
# Website can display:
# http://localhost:5001/tracking_stream
# ============================================================

app = Flask(__name__)

latest_frame = None
frame_lock = threading.Lock()


def generate_tracking_stream():
    global latest_frame

    while True:
        with frame_lock:
            frame = latest_frame

        if frame is not None:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame
                + b"\r\n"
            )


@app.route("/tracking_stream")
def tracking_stream():
    return Response(
        generate_tracking_stream(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


def start_web_server():
    app.run(
        host="0.0.0.0",
        port=5001,
        threaded=True,
        debug=False,
        use_reloader=False
    )


web_thread = threading.Thread(
    target=start_web_server,
    daemon=True
)
web_thread.start()

print("==============================================")
print(" PATIENT TRACKING WEB STREAM")
print(" http://localhost:5001/tracking_stream")
print("==============================================")

# -----------------------------
# Tilt settings
# -----------------------------

# Patient's current position is calibrated as 0 degrees by pressing C.
REST_LIMIT = 15       # +/-15 = REST
FULL_TILT = 75        # 75-90 degrees = near full tilt

angle_history = []
BASELINE_ANGLE = None

# Keep the last good body position when MediaPipe
# temporarily loses one shoulder during movement.
last_tracking = None
lost_frames = 0
MAX_LOST_FRAMES = 30

# More tolerant for ESP32-CAM movement/video.
VISIBILITY_THRESHOLD = 0.30


def get_point(p):
    return (int(p.x * width), int(p.y * height))


def shoulder_angle(left, right):
    """Angle of the chest/shoulder line in the camera image."""
    dx = right[0] - left[0]
    dy = right[1] - left[1]
    return math.degrees(math.atan2(dy, dx))


def angle_difference(angle, baseline):
    """Return signed angle difference in the range -180 to +180."""
    d = angle - baseline

    while d > 180:
        d -= 360

    while d < -180:
        d += 360

    return d


def smooth_angle(value):
    """Smooth small frame-to-frame movements."""
    angle_history.append(value)

    if len(angle_history) > 10:
        angle_history.pop(0)

    radians = np.deg2rad(angle_history)

    return math.degrees(
        math.atan2(
            np.mean(np.sin(radians)),
            np.mean(np.cos(radians))
        )
    )


def get_tilt_status(delta):
    if abs(delta) <= REST_LIMIT:
        return "REST / NORMAL"

    if delta > 0:
        status = "LEFT TILT"
    else:
        status = "RIGHT TILT"

    if abs(delta) >= FULL_TILT:
        status += "  ~90 DEG"

    return status


with mp_pose.Pose(
    static_image_mode=False,
    model_complexity=2,
    smooth_landmarks=True,
    min_detection_confidence=0.40,
    min_tracking_confidence=0.40
) as pose:

    while True:

        success, frame = cap.read()

        if not success:
            print("Could not read camera.")
            break

        # Mirror camera
        frame = cv2.flip(frame, 1)

        height, width = frame.shape[:2]

        # Convert BGR -> RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Detect body
        result = pose.process(rgb)

        # Default display values
        tilt_angle = 0.0
        tilt_status = "CHEST NOT DETECTED"

        if result.pose_landmarks:

            lm = result.pose_landmarks.landmark

            # -----------------------------
            # Get required body points
            # -----------------------------

            left_shoulder = lm[mp_pose.PoseLandmark.LEFT_SHOULDER]
            right_shoulder = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER]

            left_elbow = lm[mp_pose.PoseLandmark.LEFT_ELBOW]
            right_elbow = lm[mp_pose.PoseLandmark.RIGHT_ELBOW]

            left_wrist = lm[mp_pose.PoseLandmark.LEFT_WRIST]
            right_wrist = lm[mp_pose.PoseLandmark.RIGHT_WRIST]

            left_hip = lm[mp_pose.PoseLandmark.LEFT_HIP]
            right_hip = lm[mp_pose.PoseLandmark.RIGHT_HIP]

            # Check whether both shoulders are currently reliable.
            shoulders_visible = (
                left_shoulder.visibility > VISIBILITY_THRESHOLD and
                right_shoulder.visibility > VISIBILITY_THRESHOLD
            )

            # If MediaPipe briefly loses a shoulder while the patient
            # moves, keep using the last good body position.
            if shoulders_visible:
                lost_frames = 0
            else:
                lost_frames += 1

                if last_tracking is not None and lost_frames <= MAX_LOST_FRAMES:
                    (
                        LS, RS, LE, RE, LW, RW,
                        LH, RH, CHEST, MIDDLE, HIP
                    ) = last_tracking
                    shoulders_visible = True

            if shoulders_visible:

                # -----------------------------
                # Convert coordinates
                # -----------------------------

                LS = get_point(left_shoulder)
                RS = get_point(right_shoulder)

                LE = get_point(left_elbow)
                RE = get_point(right_elbow)

                LW = get_point(left_wrist)
                RW = get_point(right_wrist)

                LH = get_point(left_hip)
                RH = get_point(right_hip)

                # -----------------------------
                # Central body points
                # -----------------------------

                # Chest center
                chest_x = int((LS[0] + RS[0]) / 2)
                chest_y = int((LS[1] + RS[1]) / 2)

                CHEST = (chest_x, chest_y)

                # Body center / hip
                hip_x = int((LH[0] + RH[0]) / 2)
                hip_y = int((LH[1] + RH[1]) / 2)

                HIP = (hip_x, hip_y)

                # Middle body point
                middle_x = int((CHEST[0] + HIP[0]) / 2)
                middle_y = int((CHEST[1] + HIP[1]) / 2)

                MIDDLE = (middle_x, middle_y)

                # Save this complete body position so it can be used
                # briefly if MediaPipe loses the patient during movement.
                last_tracking = (
                    LS, RS, LE, RE, LW, RW,
                    LH, RH, CHEST, MIDDLE, HIP
                )

                # -----------------------------
                # CHEST TILT DETECTION
                # -----------------------------

                # Update tilt only when the current frame has good
                # shoulder detection. During a short tracking loss,
                # keep the previous displayed tilt/status.
                if lost_frames == 0:
                    raw_angle = shoulder_angle(LS, RS)
                    smooth = smooth_angle(raw_angle)

                    if BASELINE_ANGLE is None:
                        tilt_status = "PRESS C = SET REST POSITION"
                        tilt_angle = 0.0
                    else:
                        tilt_angle = angle_difference(
                            smooth,
                            BASELINE_ANGLE
                        )
                        tilt_status = get_tilt_status(tilt_angle)

                # -----------------------------
                # Draw LEFT ARM
                # -----------------------------

                cv2.line(
                    frame,
                    LW,
                    LE,
                    LINE_COLOR,
                    3
                )

                cv2.line(
                    frame,
                    LE,
                    LS,
                    LINE_COLOR,
                    3
                )

                # -----------------------------
                # Draw RIGHT ARM
                # -----------------------------

                cv2.line(
                    frame,
                    RS,
                    RE,
                    LINE_COLOR,
                    3
                )

                cv2.line(
                    frame,
                    RE,
                    RW,
                    LINE_COLOR,
                    3
                )

                # -----------------------------
                # Draw shoulders -> chest
                # -----------------------------

                cv2.line(
                    frame,
                    LS,
                    CHEST,
                    LINE_COLOR,
                    3
                )

                cv2.line(
                    frame,
                    RS,
                    CHEST,
                    LINE_COLOR,
                    3
                )

                # -----------------------------
                # CENTRAL CHEST LINE
                # Only chest region, not full body
                # -----------------------------

                chest_line_length = int(
                    max(
                        60,
                        abs(RS[0] - LS[0]) * 1.5
                    )
                )

                cv2.line(
                    frame,
                    (CHEST[0], CHEST[1] - 20),
                    (CHEST[0], CHEST[1] + chest_line_length),
                    CHEST_COLOR,
                    3
                )

                # -----------------------------
                # CENTRAL BODY LINE
                # -----------------------------

                cv2.line(
                    frame,
                    CHEST,
                    MIDDLE,
                    LINE_COLOR,
                    3
                )

                cv2.line(
                    frame,
                    MIDDLE,
                    HIP,
                    LINE_COLOR,
                    3
                )

                # -----------------------------
                # Draw joint points
                # -----------------------------

                points = [
                    LW,
                    LE,
                    LS,
                    CHEST,
                    RS,
                    RE,
                    RW,
                    MIDDLE,
                    HIP
                ]

                for p in points:
                    cv2.circle(
                        frame,
                        p,
                        9,
                        POINT_COLOR,
                        -1
                    )

                # Make chest center clearly visible
                cv2.circle(
                    frame,
                    CHEST,
                    11,
                    CHEST_COLOR,
                    -1
                )

        # -----------------------------
        # Information panel
        # -----------------------------

        overlay = frame.copy()

        cv2.rectangle(
            overlay,
            (0, 0),
            (width, 135),
            (20, 20, 20),
            -1
        )

        frame = cv2.addWeighted(
            overlay,
            0.82,
            frame,
            0.18,
            0
        )

        cv2.putText(
            frame,
            "PATIENT CHEST POSITION",
            (20, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )

        cv2.putText(
            frame,
            f"Chest tilt: {tilt_angle:+.1f} deg",
            (20, 68),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )

        cv2.putText(
            frame,
            f"Position: {tilt_status}",
            (20, 103),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )

        cv2.putText(
            frame,
            "C=REST   R=RESET   Q=QUIT",
            (width - 320, height - 20),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
            cv2.LINE_AA
        )

        # -----------------------------
        # Send processed tracking frame to website
        # -----------------------------

        ok, jpeg = cv2.imencode(
            ".jpg",
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, 85]
        )

        if ok:
            with frame_lock:
                latest_frame = jpeg.tobytes()

        # -----------------------------
        # Show camera
        # -----------------------------

        cv2.imshow(
            "Patient Body Tracking",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        # Press Q to quit
        if key == ord("q"):
            break

        # Press C to set current patient position as REST = 0 deg
        elif key == ord("c"):

            if result.pose_landmarks:

                lm = result.pose_landmarks.landmark

                left_shoulder = lm[
                    mp_pose.PoseLandmark.LEFT_SHOULDER
                ]

                right_shoulder = lm[
                    mp_pose.PoseLandmark.RIGHT_SHOULDER
                ]

                if (
                    left_shoulder.visibility > VISIBILITY_THRESHOLD and
                    right_shoulder.visibility > VISIBILITY_THRESHOLD
                ):

                    LS = (
                        left_shoulder.x * width,
                        left_shoulder.y * height
                    )

                    RS = (
                        right_shoulder.x * width,
                        right_shoulder.y * height
                    )

                    BASELINE_ANGLE = shoulder_angle(
                        LS,
                        RS
                    )

                    angle_history.clear()

                    print(
                        f"REST POSITION CALIBRATED: "
                        f"{BASELINE_ANGLE:.2f} degrees"
                    )

        # Press R to reset calibration
        elif key == ord("r"):

            BASELINE_ANGLE = None
            angle_history.clear()

            print("REST CALIBRATION RESET.")

cap.release()
cv2.destroyAllWindows()