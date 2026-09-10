import { RespiratoryBandpassFilter } from '../src/signalProcessing/filter';
import { RespiratoryRateEstimator } from '../src/signalProcessing/respiratoryEstimator';
import { SignalQualityCalculator } from '../src/signalProcessing/signalQuality';
import { RespiratoryEventDetector } from '../src/signalProcessing/eventDetector';

function runTests() {
  console.log('=== RUNNING BIOMEDICAL DSP UNIT TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Filter Tests
  console.log('Test Suite 1: Bandpass Filter');
  const filter = new RespiratoryBandpassFilter({ sampleRateHz: 20, lowCutHz: 0.1, highCutHz: 0.7 });
  
  let outputSum = 0;
  for (let i = 0; i < 200; i++) {
    const t = i / 20;
    const input = 5.0 + Math.sin(2 * Math.PI * 0.25 * t);
    const out = filter.process(input);
    if (i > 100) outputSum += Math.abs(out);
  }
  assert(outputSum > 10, 'Bandpass filter preserves 0.25 Hz (15 BPM) respiratory oscillation');

  // 2. Respiratory Rate Estimator Tests
  console.log('\nTest Suite 2: Respiratory Rate Estimator');
  const estimator = new RespiratoryRateEstimator(20, 25);
  let latestResult: any = null;
  const targetBpm = 18.0;
  const freq = targetBpm / 60;

  for (let i = 0; i < 400; i++) {
    const t = i / 20;
    const sample = 0.15 * Math.sin(2 * Math.PI * freq * t);
    latestResult = estimator.addSample(sample, Date.now() - (400 - i) * 50);
  }
  assert(latestResult && latestResult.isValid, 'Estimator declares signal valid after 15s');
  assert(
    latestResult && latestResult.respiratoryRateBpm !== null && Math.abs(latestResult.respiratoryRateBpm - targetBpm) <= 2.0,
    `Estimator calculates accurate RR: expected ~${targetBpm} BPM, got ${latestResult?.respiratoryRateBpm} BPM`
  );

  // 3. Signal Quality Index Tests
  console.log('\nTest Suite 3: Signal Quality Index (SQI)');
  const sqiCalc = new SignalQualityCalculator(20, 10);
  let sqiResult: any = null;

  for (let i = 0; i < 100; i++) {
    const t = i / 20;
    const cleanSignal = 0.12 * Math.sin(2 * Math.PI * 0.25 * t);
    sqiResult = sqiCalc.update(cleanSignal, cleanSignal + 0.002 * (Math.random() - 0.5));
  }
  assert(sqiResult && sqiResult.sqi >= 70, `Clean respiratory signal receives high SQI (got ${sqiResult?.sqi}%)`);

  // 4. Apnea Detection Logic Tests
  console.log('\nTest Suite 4: Apnea Detection State Machine');
  const detector = new RespiratoryEventDetector(10, 25, 10, 35, 20);
  
  let eventOut = detector.evaluate({
    timestamp: 1000,
    filteredSignal: 0.15,
    respiratoryRate: 16.0,
    signalQuality: 90,
    presence: true,
    isRadarConnected: true,
    sampleRateHz: 20
  });
  assert(eventOut.currentState === 'NORMAL_BREATHING', 'Normal breathing detected during normal oscillation');

  eventOut = detector.evaluate({
    timestamp: 2000,
    filteredSignal: 0.0,
    respiratoryRate: null,
    signalQuality: 15,
    presence: true,
    isRadarConnected: true,
    sampleRateHz: 20
  });
  assert(eventOut.currentState === 'INSUFFICIENT_SIGNAL', 'Poor signal quality correctly classified as INSUFFICIENT_SIGNAL (not apnea)');

  detector.reset();
  const startTime = 10000;
  for (let s = 0; s <= 12; s++) {
    eventOut = detector.evaluate({
      timestamp: startTime + s * 1000,
      filteredSignal: 0.001,
      respiratoryRate: null,
      signalQuality: 85,
      presence: true,
      isRadarConnected: true,
      sampleRateHz: 20
    });
  }
  assert(eventOut.currentState === 'POSSIBLE_APNEA', 'True cessation for > 10s triggers POSSIBLE_APNEA event');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
