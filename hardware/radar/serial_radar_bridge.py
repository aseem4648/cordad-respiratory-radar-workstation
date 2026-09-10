import sys
import time
import argparse
import requests

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[ERROR] pyserial is not installed. Run: pip install pyserial requests")
    sys.exit(1)

def list_available_ports():
    ports = serial.tools.list_ports.comports()
    print("\n--- Available COM Ports on this Machine ---")
    for p in ports:
        print(f"  * {p.device}: {p.description} (HWID: {p.hwid})")
    print("-------------------------------------------\n")

def main():
    parser = argparse.ArgumentParser(description="24 GHz Radar USB Serial to HTTP/WS Bridge")
    parser.add_argument("--port", type=str, default=None, help="COM port (e.g., COM3, COM4, /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Radar baud rate (default: 115200)")
    parser.add_argument("--host", type=str, default="http://localhost:5000", help="Backend base URL")
    args = parser.parse_args()

    list_available_ports()

    port_name = args.port
    if not port_name:
        ports = serial.tools.list_ports.comports()
        if ports:
            port_name = ports[0].device
            print(f"[AUTO] No port specified. Selecting first available port: {port_name}")
        else:
            print("[ERROR] No serial COM ports detected. Please plug in your 24 GHz radar USB cable.")
            sys.exit(1)

    ingest_url = f"{args.host.rstrip('/')}/api/radar/data"
    print(f"[INFO] Connecting to 24 GHz Radar on {port_name} at {args.baud} baud...")
    print(f"[INFO] Streaming target endpoint: {ingest_url}")

    try:
        ser = serial.Serial(port_name, args.baud, timeout=1)
        print(f"[SUCCESS] Serial link open on {port_name}. Listening for FMCW radar packets...\n")
    except Exception as e:
        print(f"[ERROR] Could not open serial port {port_name}: {e}")
        sys.exit(1)

    packet_count = 0
    start_time = time.time()

    while True:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                continue

            packet_count += 1
            now = time.time()
            rate = packet_count / (now - start_time) if (now - start_time) > 0 else 0

            payload = None
            if line.startswith('{') and line.endswith('}'):
                try:
                    payload = requests.compat.json.loads(line)
                except Exception:
                    pass

            if not payload:
                payload = {"raw": line, "timestamp": int(now * 1000)}

            try:
                requests.post(ingest_url, json=payload, timeout=0.5)
                if packet_count % 20 == 0:
                    print(f"[STREAM] {packet_count} packets relayed ({rate:.1f} pkt/s) | Last: {line[:50]}")
            except requests.exceptions.RequestException:
                if packet_count % 50 == 0:
                    print(f"[WARNING] Waiting for backend server at {ingest_url}...")

        except KeyboardInterrupt:
            print("\n[STOP] Exiting serial bridge...")
            break
        except Exception as e:
            print(f"[ERROR] Reading serial stream: {e}")
            time.sleep(0.1)

    ser.close()

if __name__ == '__main__':
    main()
