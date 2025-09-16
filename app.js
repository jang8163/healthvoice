// HealthVoice - 음성 기반 건강 & 웰빙 도우미
// Main Application JavaScript

class HealthVoice {
    constructor() {
        this.currentSection = 'dashboard';
        this.isListening = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.medications = JSON.parse(localStorage.getItem('medications')) || [];
        this.healthData = JSON.parse(localStorage.getItem('healthData')) || {
            water: { daily: 0, goal: 8, lastReset: new Date().toDateString() },
            sleep: [],
            bloodPressure: [],
            bloodSugar: [],
            mood: []
        };
        this.exerciseData = JSON.parse(localStorage.getItem('exerciseData')) || [];
        
        this.init();
    }

    init() {
        this.initSpeechRecognition();
        this.initEventListeners();
        this.initTimers();
        this.updateDashboard();
        this.updateCurrentTime();
        this.resetDailyData();
        
        // 페이지 로드 시 인사말
        setTimeout(() => {
            this.speak('안녕하세요! HealthVoice입니다. 건강한 하루를 시작해볼까요?');
        }, 1000);
    }

    // 음성 인식 초기화
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'ko-KR';

            this.recognition.onstart = () => {
                this.isListening = true;
                this.showVoiceModal();
                this.updateVoiceText('듣고 있습니다...');
            };

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.updateVoiceText(`"${transcript}"`);
                this.processVoiceCommand(transcript);
            };

            this.recognition.onerror = (event) => {
                console.error('음성 인식 오류:', event.error);
                this.hideVoiceModal();
                this.isListening = false;
                this.showToast('음성 인식에 실패했습니다. 다시 시도해주세요.', 'error');
            };

            this.recognition.onend = () => {
                this.isListening = false;
                setTimeout(() => {
                    this.hideVoiceModal();
                }, 2000);
            };
        } else {
            console.warn('이 브라우저는 음성 인식을 지원하지 않습니다.');
        }
    }

    // 이벤트 리스너 초기화
    initEventListeners() {
        // 네비게이션
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.showSection(section);
            });
        });

        // 음성 버튼들
        document.getElementById('mainVoiceBtn').addEventListener('click', () => this.startListening());
        document.getElementById('floatingVoiceBtn').addEventListener('click', () => this.startListening());
        document.getElementById('voiceCommandBtn').addEventListener('click', () => this.startListening());
        
        // 복약 완료 버튼
        document.getElementById('markTakenBtn').addEventListener('click', () => this.markMedicationTakenManually());

        // 모달 관련
        document.getElementById('closeVoiceModal').addEventListener('click', () => this.hideVoiceModal());
        document.getElementById('addMedicationBtn').addEventListener('click', () => this.showMedicationModal());
        document.getElementById('closeMedicationModal').addEventListener('click', () => this.hideMedicationModal());
        document.getElementById('cancelMedicationBtn').addEventListener('click', () => this.hideMedicationModal());

        // 복약 관리
        document.getElementById('medicationForm').addEventListener('submit', (e) => this.addMedication(e));
        document.getElementById('medicationFrequency').addEventListener('change', (e) => this.updateTimeInputs(e.target.value));

        // 건강 기록 탭
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.showHealthTab(tab);
            });
        });

        // 건강 기록 버튼들
        document.getElementById('drinkWaterBtn').addEventListener('click', () => this.recordWater());
        document.getElementById('recordSleepBtn').addEventListener('click', () => this.recordSleep());
        document.getElementById('recordBPBtn').addEventListener('click', () => this.recordBloodPressure());
        document.getElementById('recordBSBtn').addEventListener('click', () => this.recordBloodSugar());

        // 기분 기록
        document.querySelectorAll('.mood-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mood-option').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
            });
        });
        document.getElementById('saveMoodBtn').addEventListener('click', () => this.saveMood());

        // 명상
        document.querySelectorAll('.meditation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const duration = parseInt(e.currentTarget.dataset.duration);
                this.startMeditation(duration);
            });
        });

        // 운동
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.startExercise(category);
            });
        });

        // 모달 외부 클릭시 닫기
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // 응급 버튼
        document.getElementById('emergencyBtn').addEventListener('click', () => this.handleEmergency());
    }

    // 타이머 초기화
    initTimers() {
        // 매 시간마다 물 마시기 알림
        setInterval(() => {
            if (this.shouldRemindWater()) {
                this.speak('물 마실 시간입니다. 수분을 충분히 섭취하세요.');
                this.showToast('💧 물 마실 시간입니다!', 'info');
            }
        }, 3600000); // 1시간

        // 복약 알림 체크 (매 분)
        setInterval(() => {
            this.checkMedicationReminders();
        }, 60000);

        // 시간 업데이트 (매 초)
        setInterval(() => {
            this.updateCurrentTime();
        }, 1000);

        // 장시간 앉아있기 알림 (2시간마다)
        setInterval(() => {
            this.speak('잠시 일어나서 스트레칭을 해보세요. 건강한 자세를 유지하는 것이 중요합니다.');
            this.showToast('🚶‍♂️ 잠시 일어나서 움직여보세요!', 'info');
        }, 7200000); // 2시간
        
        // 알림 권한 요청
        this.requestNotificationPermission();
        
        // 물 마시기 알림 스케줄 설정
        this.setupWaterReminders();
    }

    // 섹션 전환
    showSection(sectionId) {
        // 모든 섹션 숨기기
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // 모든 네비게이션 버튼 비활성화
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 선택된 섹션 표시
        document.getElementById(sectionId).classList.add('active');
        document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

        this.currentSection = sectionId;

        // 섹션별 초기화
        if (sectionId === 'dashboard') {
            this.updateDashboard();
        } else if (sectionId === 'medication') {
            this.renderMedicationList();
            this.renderMedicationSchedule();
        } else if (sectionId === 'health') {
            this.updateHealthTabs();
        }
    }

    // 음성 인식 시작
    startListening() {
        if (!this.recognition) {
            this.showToast('이 브라우저는 음성 인식을 지원하지 않습니다.', 'error');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
            return;
        }

        this.recognition.start();
    }

    // 음성 명령 처리
    processVoiceCommand(command) {
        const cmd = command.toLowerCase().trim();
        
        // 복약 관련 명령
        if (cmd.includes('먹었') || cmd.includes('복용')) {
            this.markMedicationTaken();
            this.speak('복약을 확인했습니다. 잘하셨어요!');
            this.showToast('✅ 복약이 기록되었습니다.', 'success');
        }
        // 물 마시기 명령
        else if (cmd.includes('물') && (cmd.includes('마셨') || cmd.includes('마심'))) {
            this.recordWater();
            this.speak('물 마시기를 기록했습니다. 수분 섭취를 꾸준히 해주세요.');
        }
        // 수면 기록 명령
        else if (cmd.includes('잠') || cmd.includes('수면')) {
            const hours = this.extractNumber(cmd);
            if (hours) {
                this.recordSleep(hours);
                this.speak(`${hours}시간 수면을 기록했습니다.`);
            } else {
                this.speak('수면 시간을 알려주세요. 예: 7시간 잤어요');
            }
        }
        // 기분 기록 명령
        else if (cmd.includes('기분') || cmd.includes('좋') || cmd.includes('나쁘') || cmd.includes('스트레스')) {
            let mood = 'neutral';
            if (cmd.includes('좋') || cmd.includes('행복') || cmd.includes('기뻐')) mood = 'happy';
            else if (cmd.includes('나쁘') || cmd.includes('우울') || cmd.includes('슬프')) mood = 'sad';
            else if (cmd.includes('스트레스') || cmd.includes('화나') || cmd.includes('짜증')) mood = 'angry';
            else if (cmd.includes('최고') || cmd.includes('완전') || cmd.includes('매우')) mood = 'very-happy';
            
            this.recordMood(mood, cmd);
            this.speak('기분을 기록했습니다. 오늘도 좋은 하루 되세요.');
        }
        // 운동 명령
        else if (cmd.includes('운동') || cmd.includes('스트레칭') || cmd.includes('체조')) {
            if (cmd.includes('스트레칭')) {
                this.startExercise('stretch');
            } else if (cmd.includes('유산소') || cmd.includes('걷기')) {
                this.startExercise('cardio');
            } else {
                this.startExercise('strength');
            }
            this.speak('운동을 시작하겠습니다. 함께 건강해져요!');
        }
        // 명상 명령
        else if (cmd.includes('명상') || cmd.includes('호흡') || cmd.includes('마음')) {
            this.startMeditation(5);
            this.speak('5분 명상을 시작합니다. 편안한 자세로 앉아주세요.');
        }
        // 혈압 기록 명령
        else if (cmd.includes('혈압')) {
            const numbers = cmd.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                this.recordBloodPressure(numbers[0], numbers[1]);
                this.speak(`혈압 ${numbers[0]}/${numbers[1]}을 기록했습니다.`);
            } else {
                this.speak('혈압 수치를 알려주세요. 예: 혈압 120 80');
            }
        }
        // 도움말
        else if (cmd.includes('도움') || cmd.includes('명령')) {
            this.showHelp();
        }
        // 기본 응답
        else {
            this.speak('죄송합니다. 명령을 이해하지 못했습니다. 도움말을 원하시면 "도움"이라고 말씀해주세요.');
        }

        // 대시보드 업데이트
        this.updateDashboard();
    }

    // 숫자 추출
    extractNumber(text) {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    }

    // TTS 음성 출력 (부드러운 여성 간호사 톤)
    speak(text) {
        if (this.synthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ko-KR';
            
            // 부드러운 여성 간호사 톤 설정
            utterance.rate = 0.8;     // 조금 더 천천히
            utterance.pitch = 1.2;    // 조금 더 높은 음성
            utterance.volume = 0.9;   // 부드러운 볼륨
            
            // 사용 가능한 한국어 여성 음성 찾기
            const voices = this.synthesis.getVoices();
            const koreanFemaleVoice = voices.find(voice => 
                voice.lang.includes('ko') && 
                (voice.name.includes('Female') || voice.name.includes('여성') || voice.name.includes('Woman'))
            );
            
            if (koreanFemaleVoice) {
                utterance.voice = koreanFemaleVoice;
            } else {
                // 한국어 음성이 있으면 사용
                const koreanVoice = voices.find(voice => voice.lang.includes('ko'));
                if (koreanVoice) {
                    utterance.voice = koreanVoice;
                }
            }
            
            this.synthesis.speak(utterance);
        }
    }

    // 음성 합성 중단
    speakStop() {
        if (this.synthesis) {
            this.synthesis.cancel();
        }
    }

    // 대시보드 업데이트
    updateDashboard() {
        this.updateMedicationProgress();
        this.updateHealthSummary();
        this.updateMoodDisplay();
        this.updateExerciseSummary();
    }

    // 복약 진행상황 업데이트
    updateMedicationProgress() {
        const today = new Date().toDateString();
        const todayMedications = this.getTodayMedications();
        const takenMedications = todayMedications.filter(med => med.taken);
        
        // 진행률 계산
        const total = todayMedications.length;
        const taken = takenMedications.length;
        const percentage = total > 0 ? (taken / total) * 100 : 0;
        
        // 프로그레스 링 업데이트
        const progressCircle = document.querySelector('.progress-ring-circle');
        if (progressCircle) {
            const circumference = 2 * Math.PI * 30; // r=30
            const offset = circumference - (percentage / 100) * circumference;
            progressCircle.style.strokeDashoffset = offset;
            progressCircle.style.stroke = percentage === 100 ? '#48bb78' : '#667eea';
        }
        
        // 텍스트 업데이트
        const progressText = document.querySelector('.progress-text');
        if (progressText) {
            progressText.querySelector('.taken').textContent = taken;
            progressText.querySelector('.total').textContent = total;
        }
        
        // 다음 복약 시간
        const nextMedication = this.getNextMedication();
        const nextMedicationEl = document.querySelector('.next-medication');
        if (nextMedicationEl) {
            nextMedicationEl.textContent = nextMedication ? `다음 복약: ${nextMedication.time}` : '오늘 복약 완료!';
        }
        
        // 오늘의 복약 목록
        const medicationListEl = document.getElementById('todayMedications');
        if (medicationListEl) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            medicationListEl.innerHTML = todayMedications.map(med => {
                let status = '○'; // 기본 대기
                let statusClass = '';
                
                if (med.taken) {
                    status = '✓'; // 복용 완료
                    statusClass = 'medication-taken';
                } else if (med.time < currentTime) {
                    status = '✗'; // 시간 지나서 미복용
                    statusClass = 'medication-missed';
                }
                
                return `
                    <div class="medication-item ${statusClass}">
                        <span>${med.name} (${med.time})</span>
                        <span class="medication-status">${status}</span>
                    </div>
                `;
            }).join('');
        }
        
        // 복약 완료 버튼 표시/숨김
        this.updateMedicationTakenButton();
    }
    
    // 복약 완료 버튼 상태 업데이트
    updateMedicationTakenButton() {
        const markTakenBtn = document.getElementById('markTakenBtn');
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayMedications = this.getTodayMedications();
        
        // 현재 시간 이후의 가장 가까운 미복용 약물 찾기 (미래 알림 우선)
        const futureMedications = todayMedications.filter(med => !med.taken && med.time >= currentTime);
        let targetMed = futureMedications.length > 0 ? futureMedications[0] : null;
        
        // 미래 약이 없으면 과거 미복용 약 중 가장 가까운 것
        if (!targetMed) {
            const pastMedications = todayMedications.filter(med => !med.taken && med.time < currentTime);
            targetMed = pastMedications.length > 0 ? pastMedications[pastMedications.length - 1] : null;
        }
        
        // 미복용 약물이 있고, 현재 시간이 복약 시간에 가까우면 버튼 표시
        const pendingMedications = todayMedications.filter(med => !med.taken);
        const hasNearbyMedication = pendingMedications.some(med => {
            const medTime = med.time.split(':').map(n => parseInt(n));
            const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
            const medTimeMinutes = medTime[0] * 60 + medTime[1];
            const diff = Math.abs(currentTimeMinutes - medTimeMinutes);
            return diff <= 30; // 30분 이내
        });
        
        if (markTakenBtn) {
            if (pendingMedications.length > 0 && (hasNearbyMedication || targetMed)) {
                markTakenBtn.style.display = 'block';
                if (targetMed) {
                    markTakenBtn.innerHTML = `<i class="fas fa-check"></i> ${targetMed.name} (${targetMed.time}) 먹었어요`;
                } else {
                    markTakenBtn.innerHTML = `<i class="fas fa-check"></i> 약 먹었어요`;
                }
            } else {
                markTakenBtn.style.display = 'none';
            }
        }
    }

    // 건강 요약 업데이트
    updateHealthSummary() {
        // 물 마시기
        const waterCount = document.getElementById('waterCount');
        if (waterCount) {
            waterCount.textContent = `${this.healthData.water.daily}/${this.healthData.water.goal}잔`;
        }
        
        // 수면
        const sleepHours = document.getElementById('sleepHours');
        if (sleepHours) {
            const lastSleep = this.healthData.sleep[this.healthData.sleep.length - 1];
            sleepHours.textContent = lastSleep ? `${lastSleep.hours}시간` : '-시간';
        }
        
        // 혈압
        const bloodPressure = document.getElementById('bloodPressure');
        if (bloodPressure) {
            const lastBP = this.healthData.bloodPressure[this.healthData.bloodPressure.length - 1];
            bloodPressure.textContent = lastBP ? `${lastBP.systolic}/${lastBP.diastolic}` : '-/-';
        }
    }

    // 기분 표시 업데이트
    updateMoodDisplay() {
        const todayMood = this.getTodayMood();
        const moodDisplay = document.getElementById('todayMood');
        
        if (moodDisplay && todayMood) {
            const moodEmojis = {
                'very-happy': '😄',
                'happy': '😊',
                'neutral': '😐',
                'sad': '😔',
                'angry': '😠'
            };
            
            moodDisplay.innerHTML = `
                <div class="mood-emoji">${moodEmojis[todayMood.mood]}</div>
                <p>${todayMood.note || '좋은 하루 보내세요!'}</p>
            `;
        }
    }

    // 운동 요약 업데이트
    updateExerciseSummary() {
        const exerciseSummary = document.getElementById('exerciseSummary');
        const todayExercise = this.getTodayExercise();
        
        if (exerciseSummary) {
            if (todayExercise.length > 0) {
                const totalMinutes = todayExercise.reduce((sum, ex) => sum + ex.duration, 0);
                exerciseSummary.innerHTML = `
                    <p>오늘 ${totalMinutes}분 운동했습니다! 🎉</p>
                    <button class="btn btn-primary" onclick="healthVoice.startQuickExercise()">
                        <i class="fas fa-play"></i> 추가 운동 시작
                    </button>
                `;
            } else {
                exerciseSummary.innerHTML = `
                    <p>아직 운동을 시작하지 않았습니다.</p>
                    <button class="btn btn-primary" onclick="healthVoice.startQuickExercise()">
                        <i class="fas fa-play"></i> 빠른 운동 시작
                    </button>
                `;
            }
        }
    }

    // 현재 시간 업데이트
    updateCurrentTime() {
        const timeEl = document.querySelector('.current-time');
        if (timeEl) {
            const now = new Date();
            const timeString = now.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
                hour: '2-digit',
                minute: '2-digit'
            });
            timeEl.textContent = timeString;
        }
    }

    // 일일 데이터 리셋
    resetDailyData() {
        const today = new Date().toDateString();
        
        // 물 마시기 데이터 리셋
        if (this.healthData.water.lastReset !== today) {
            this.healthData.water.daily = 0;
            this.healthData.water.lastReset = today;
            this.saveHealthData();
        }
    }

    // 복약 관련 메서드들
    getTodayMedications() {
        const today = new Date();
        const todayString = today.toDateString();
        
        return this.medications.flatMap(med => 
            med.times.map(time => ({
                id: med.id,
                name: med.name,
                time: time,
                taken: med.takenDates && med.takenDates[todayString] && 
                       med.takenDates[todayString].includes(time)
            }))
        ).sort((a, b) => a.time.localeCompare(b.time));
    }

    getNextMedication() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayMedications = this.getTodayMedications();
        
        return todayMedications.find(med => !med.taken && med.time > currentTime);
    }

    markMedicationTaken() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayString = now.toDateString();
        
        // 현재 시간 이후의 가장 가까운 미복용 약물 찾기 (미래 알림)
        const todayMedications = this.getTodayMedications();
        const futureMedications = todayMedications.filter(med => !med.taken && med.time >= currentTime);
        
        // 미래에 복용할 약이 있으면 그것을 우선 처리
        let targetMed = futureMedications.length > 0 ? futureMedications[0] : null;
        
        // 미래 약이 없으면 과거 미복용 약 중 가장 가까운 것
        if (!targetMed) {
            const pastMedications = todayMedications.filter(med => !med.taken && med.time < currentTime);
            targetMed = pastMedications.length > 0 ? pastMedications[pastMedications.length - 1] : null;
        }
        
        if (targetMed) {
            const medication = this.medications.find(med => med.id === targetMed.id);
            if (medication) {
                if (!medication.takenDates) medication.takenDates = {};
                if (!medication.takenDates[todayString]) medication.takenDates[todayString] = [];
                
                medication.takenDates[todayString].push(targetMed.time);
                this.saveMedications();
                this.updateDashboard();
                
                console.log(`약물 복용 기록: ${targetMed.name} - ${targetMed.time}`);
            }
        }
    }
    
    // 수동으로 복약 완료 처리 (버튼 클릭시)
    markMedicationTakenManually() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayMedications = this.getTodayMedications();
        
        // 현재 시간 이후의 가장 가까운 미복용 약물 찾기 (미래 알림 우선)
        const futureMedications = todayMedications.filter(med => !med.taken && med.time >= currentTime);
        let targetMed = futureMedications.length > 0 ? futureMedications[0] : null;
        
        // 미래 약이 없으면 과거 미복용 약 중 가장 가까운 것
        if (!targetMed) {
            const pastMedications = todayMedications.filter(med => !med.taken && med.time < currentTime);
            targetMed = pastMedications.length > 0 ? pastMedications[pastMedications.length - 1] : null;
        }
        
        if (targetMed) {
            this.markMedicationTaken();
            this.speak(`${targetMed.name} ${targetMed.time} 복약을 확인했습니다. 잘하셨어요!`);
            this.showToast(`✅ ${targetMed.name} (${targetMed.time}) 복약이 기록되었습니다.`, 'success');
            
            // 복약 완료 후 버튼 상태 업데이트
            setTimeout(() => {
                this.updateMedicationTakenButton();
            }, 500);
        } else {
            this.speak('복용할 약물이 없습니다.');
            this.showToast('복용할 약물이 없습니다.', 'info');
        }
    }

    checkMedicationReminders() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const todayMedications = this.getTodayMedications();
        
        todayMedications.forEach(med => {
            if (!med.taken && med.time === currentTime) {
                this.speak(`${med.name} 복용 시간입니다. 약을 드세요.`);
                this.showToast(`💊 ${med.name} 복용 시간입니다!`, 'warning');
            }
        });
    }

    // 건강 기록 메서드들
    recordWater() {
        this.healthData.water.daily++;
        this.saveHealthData();
        this.updateWaterDisplay();
        this.updateDashboard();
        this.showToast('💧 물 한 잔을 기록했습니다!', 'success');
        
        if (this.healthData.water.daily >= this.healthData.water.goal) {
            this.speak('오늘 수분 섭취 목표를 달성했습니다! 훌륭해요!');
        }
    }

    recordSleep(hours) {
        console.log('recordSleep 함수 호출됨:', hours);
        if (!hours) {
            const sleepInput = document.getElementById('sleepTime');
            console.log('sleepInput 요소:', sleepInput);
            if (!sleepInput) {
                this.showToast('수면 시간 입력 필드를 찾을 수 없습니다.', 'error');
                return;
            }
            hours = parseFloat(sleepInput.value);
            console.log('입력된 수면 시간:', hours);
            sleepInput.value = '';
        }
        
        if (hours && hours > 0 && hours <= 24) {
            this.healthData.sleep.push({
                date: new Date().toDateString(),
                hours: hours,
                timestamp: Date.now()
            });
            this.saveHealthData();
            this.updateDashboard();
            this.updateSleepChart();
            this.showToast(`😴 ${hours}시간 수면을 기록했습니다!`, 'success');
            
            // 수면 시간별 맞춤 음성 멘트
            if (hours < 4) {
                this.speak('심각한 수면부족! 수면이 심각하게 부족합니다! 건강에 매우 위험해요. 오늘은 꼭 일찍 주무세요.');
            } else if (hours < 5) {
                this.speak('수면부족! 수면이 많이 부족하네요. 면역력이 떨어질 수 있어요. 충분한 휴식을 취하세요.');
            } else if (hours < 6) {
                this.speak('수면부족! 수면 시간이 부족합니다. 오늘 하루 피곤하실 텐데, 오늘밤엔 일찍 주무세요.');
            } else if (hours < 7) {
                this.speak('보통수면! 조금 더 주무시면 좋겠어요. 7-8시간 수면이 가장 이상적이에요.');
            } else if (hours >= 7 && hours <= 8.5) {
                this.speak('완벽한수면! 완벽한 수면시간이에요! 건강한 하루를 시작하세요. 정말 잘하셨어요!');
            } else if (hours <= 10) {
                this.speak('과다수면! 조금 많이 주무셨네요. 적당한 수면이 더 좋아요. 그래도 푹 쉬셨길 바라요.');
            } else {
                this.speak('과다수면! 너무 많이 주무셨어요. 과다수면도 피로감을 줄 수 있으니 주의하세요.');
            }
        } else {
            this.showToast('올바른 수면 시간을 입력해주세요 (0-24시간)', 'error');
            console.log('잘못된 수면 시간 값:', hours);
        }
    }

    recordBloodPressure(systolic, diastolic) {
        console.log('recordBloodPressure 함수 호출됨:', systolic, diastolic);
        if (!systolic || !diastolic) {
            const systolicInput = document.getElementById('systolic');
            const diastolicInput = document.getElementById('diastolic');
            console.log('혈압 입력 요소들:', systolicInput, diastolicInput);
            
            if (!systolicInput || !diastolicInput) {
                this.showToast('혈압 입력 필드를 찾을 수 없습니다.', 'error');
                return;
            }
            
            systolic = parseInt(systolicInput.value);
            diastolic = parseInt(diastolicInput.value);
            console.log('입력된 혈압 값:', systolic, diastolic);
            systolicInput.value = '';
            diastolicInput.value = '';
        }
        
        if (systolic && diastolic && !isNaN(systolic) && !isNaN(diastolic)) {
            this.healthData.bloodPressure.push({
                date: new Date().toDateString(),
                systolic: systolic,
                diastolic: diastolic,
                timestamp: Date.now()
            });
            this.saveHealthData();
            this.updateDashboard();
            this.updateVitalsHistory();
            this.showToast(`❤️ 혈압 ${systolic}/${diastolic}을 기록했습니다!`, 'success');
            
            // 혈압별 맞춤 음성 멘트
            if (systolic >= 180 || diastolic >= 120) {
                this.speak('응급상황! 혈압이 매우 위험한 수준입니다! 즉시 병원에 가서 검사를 받으세요.');
            } else if (systolic >= 160 || diastolic >= 100) {
                this.speak('고혈압! 고혈압 2단계입니다. 반드시 의사와 상담하시고 관리가 필요해요.');
            } else if (systolic >= 140 || diastolic >= 90) {
                this.speak('고혈압! 고혈압 1단계네요. 식단 조절과 운동, 그리고 의사 상담을 받아보세요.');
            } else if (systolic >= 130 || diastolic >= 85) {
                this.speak('혈압주의! 혈압이 조금 높아요. 짠 음식을 줄이고 가벼운 운동을 해보세요.');
            } else if (systolic >= 90 && diastolic >= 60) {
                this.speak('정상혈압! 완벽한 혈압이에요! 건강관리를 정말 잘하고 계시네요.');
            } else if (systolic >= 80 && diastolic >= 50) {
                this.speak('저혈압! 혈압이 조금 낮아요. 수분 섭취를 늘리고 천천히 일어나세요.');
            } else {
                this.speak('위험한저혈압! 혈압이 너무 낮습니다. 어지러움을 느끼시면 즉시 앉거나 누우세요.');
            }
        } else {
            this.showToast('올바른 혈압 값을 입력해주세요', 'error');
            console.log('잘못된 혈압 값:', systolic, diastolic);
        }
    }

    recordBloodSugar() {
        console.log('recordBloodSugar 함수 호출됨');
        const bloodSugarInput = document.getElementById('bloodSugar');
        console.log('bloodSugar 입력 요소:', bloodSugarInput);
        
        if (!bloodSugarInput) {
            this.showToast('혈당 입력 필드를 찾을 수 없습니다.', 'error');
            return;
        }
        
        const bloodSugar = parseInt(bloodSugarInput.value);
        console.log('입력된 혈당 값:', bloodSugar);
        bloodSugarInput.value = '';
        
        if (bloodSugar && !isNaN(bloodSugar) && bloodSugar > 0) {
            this.healthData.bloodSugar.push({
                date: new Date().toDateString(),
                value: bloodSugar,
                timestamp: Date.now()
            });
            this.saveHealthData();
            this.updateVitalsHistory();
            this.showToast(`🩸 혈당 ${bloodSugar}mg/dL을 기록했습니다!`, 'success');
            
            // 혈당별 맞춤 음성 멘트
            if (bloodSugar < 54) {
                this.speak('응급상황! 혈당이 매우 위험하게 낮습니다! 즉시 당분을 섭취하고 응급실에 가세요!');
            } else if (bloodSugar < 70) {
                this.speak('저혈당! 저혈당이에요! 사탕이나 주스를 드시고 15분 후 다시 측정해보세요.');
            } else if (bloodSugar >= 70 && bloodSugar <= 99) {
                this.speak('정상혈당! 완벽한 공복혈당이에요! 혈당 관리를 정말 잘하고 계시네요.');
            } else if (bloodSugar <= 125) {
                this.speak('혈당주의! 혈당이 조금 높아요. 당분 섭취를 줄이고 가벼운 운동을 해보세요.');
            } else if (bloodSugar <= 199) {
                this.speak('고혈당! 혈당이 높습니다. 식단을 점검하시고 의사와 상담받으세요.');
            } else if (bloodSugar <= 300) {
                this.speak('매우위험! 혈당이 매우 높습니다! 물을 많이 드시고 의사와 즉시 상담하세요.');
            } else {
                this.speak('응급상황! 혈당이 위험한 수준입니다! 즉시 병원에 가서 응급처치를 받으세요!');
            }
        } else {
            this.showToast('올바른 혈당 값을 입력해주세요', 'error');
            console.log('잘못된 혈당 값:', bloodSugar);
        }
    }

    // 기분 기록
    saveMood() {
        const selectedMood = document.querySelector('.mood-option.selected');
        const moodNote = document.getElementById('moodNote').value;
        
        if (selectedMood) {
            const mood = selectedMood.dataset.mood;
            this.recordMood(mood, moodNote);
            
            // 초기화
            selectedMood.classList.remove('selected');
            document.getElementById('moodNote').value = '';
            
            this.updateDashboard();
            this.showToast('💝 기분을 기록했습니다!', 'success');
        }
    }

    recordMood(mood, note) {
        const today = new Date().toDateString();
        
        // 오늘 기분이 이미 있으면 업데이트, 없으면 추가
        const existingIndex = this.healthData.mood.findIndex(m => m.date === today);
        const moodData = {
            date: today,
            mood: mood,
            note: note || '',
            timestamp: Date.now()
        };
        
        if (existingIndex >= 0) {
            this.healthData.mood[existingIndex] = moodData;
        } else {
            this.healthData.mood.push(moodData);
        }
        
        this.saveHealthData();
    }

    getTodayMood() {
        const today = new Date().toDateString();
        return this.healthData.mood.find(m => m.date === today);
    }

    // 명상 기능
    startMeditation(duration) {
        this.showSection('mental');
        document.getElementById('meditationSession').style.display = 'block';
        
        let timeLeft = duration * 60; // 분을 초로 변환
        const timerDisplay = document.getElementById('timerDisplay');
        const breathingText = document.querySelector('.breathing-text');
        
        this.meditationTimer = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // 호흡 가이드
            const cycle = timeLeft % 8;
            if (cycle <= 4) {
                breathingText.textContent = '천천히 숨을 들이마시세요...';
            } else {
                breathingText.textContent = '천천히 숨을 내쉬세요...';
            }
            
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(this.meditationTimer);
                this.endMeditation();
            }
        }, 1000);
        
        // 명상 시작 안내
        this.speak(`${duration}분 명상을 시작합니다. 편안한 자세로 앉아서 호흡에 집중해주세요.`);
        
        // 명상 제어 버튼
        document.getElementById('stopMeditationBtn').onclick = () => this.endMeditation();
        document.getElementById('pauseMeditationBtn').onclick = () => this.pauseMeditation();
    }

    endMeditation() {
        clearInterval(this.meditationTimer);
        document.getElementById('meditationSession').style.display = 'none';
        
        // 현재 재생 중인 음성 중단
        this.speakStop();
        
        this.speak('명상이 끝났습니다. 마음이 편안해지셨나요? 좋은 시간이었습니다.');
        this.showToast('🧘‍♀️ 명상을 완료했습니다!', 'success');
    }

    // 운동 기능
    startExercise(category) {
        this.showSection('exercise');
        
        const exercises = {
            stretch: [
                { name: '목 스트레칭', description: '목을 좌우로 천천히 돌려주세요', duration: 30 },
                { name: '어깨 스트레칭', description: '어깨를 위아래로 움직여주세요', duration: 30 },
                { name: '허리 스트레칭', description: '허리를 좌우로 비틀어주세요', duration: 30 }
            ],
            cardio: [
                { name: '제자리 걷기', description: '제자리에서 천천히 걸어주세요', duration: 60 },
                { name: '팔 벌려 뛰기', description: '가볍게 점프하며 팔을 벌려주세요', duration: 30 },
                { name: '무릎 올리기', description: '무릎을 가슴 높이까지 올려주세요', duration: 30 }
            ],
            strength: [
                { name: '스쿼트', description: '다리를 어깨너비로 벌리고 앉았다 일어서세요', duration: 30, reps: true },
                { name: '벽 팔굽혀펴기', description: '벽에 손을 대고 팔굽혀펴기를 해주세요', duration: 30, reps: true },
                { name: '플랭크', description: '엎드려서 팔과 발끝으로 몸을 지탱해주세요', duration: 30 }
            ]
        };
        
        this.currentExercise = exercises[category];
        this.currentExerciseIndex = 0;
        this.startCurrentExercise();
    }

    startCurrentExercise() {
        if (this.currentExerciseIndex >= this.currentExercise.length) {
            this.endExercise();
            return;
        }
        
        const exercise = this.currentExercise[this.currentExerciseIndex];
        document.getElementById('exerciseSession').style.display = 'block';
        document.getElementById('exerciseName').textContent = exercise.name;
        document.getElementById('exerciseDescription').textContent = exercise.description;
        
        let timeLeft = exercise.duration;
        let reps = 0;
        
        const timerEl = document.getElementById('exerciseTimer');
        const repEl = document.getElementById('repCounter');
        
        this.speak(`${exercise.name}을 시작합니다. ${exercise.description}`);
        
        this.exerciseTimer = setInterval(() => {
            timerEl.textContent = `00:${timeLeft.toString().padStart(2, '0')}`;
            
            if (exercise.reps) {
                reps++;
                repEl.textContent = `${reps} 회`;
                this.speak(reps.toString());
            }
            
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(this.exerciseTimer);
                this.speak('운동 완료! 잘하셨습니다!');
                this.currentExerciseIndex++;
                setTimeout(() => this.startCurrentExercise(), 3000);
            }
        }, 1000);
        
        // 운동 제어 버튼
        document.getElementById('nextExerciseBtn').onclick = () => {
            clearInterval(this.exerciseTimer);
            // 현재 재생 중인 음성 중단
            this.speakStop();
            this.currentExerciseIndex++;
            this.startCurrentExercise();
        };
        
        document.getElementById('stopExerciseBtn').onclick = () => this.endExercise();
    }

    endExercise() {
        clearInterval(this.exerciseTimer);
        document.getElementById('exerciseSession').style.display = 'none';
        
        // 현재 재생 중인 음성 중단
        this.speakStop();
        
        // 운동 기록 저장
        const duration = this.currentExercise.reduce((sum, ex) => sum + ex.duration, 0) / 60;
        this.exerciseData.push({
            date: new Date().toDateString(),
            duration: Math.round(duration),
            type: this.currentExercise[0].name.includes('스트레칭') ? 'stretch' : 
                  this.currentExercise[0].name.includes('걷기') ? 'cardio' : 'strength',
            timestamp: Date.now()
        });
        
        this.saveExerciseData();
        this.updateDashboard();
        this.speak('운동을 완료했습니다! 정말 잘하셨어요! 꾸준히 운동하는 것이 건강의 비결입니다.');
        this.showToast('💪 운동을 완료했습니다!', 'success');
    }

    startQuickExercise() {
        this.startExercise('stretch');
    }

    getTodayExercise() {
        const today = new Date().toDateString();
        return this.exerciseData.filter(ex => ex.date === today);
    }

    // UI 업데이트 메서드들
    updateWaterDisplay() {
        const waterLevel = document.getElementById('waterLevel');
        const waterAmount = document.getElementById('waterAmount');
        
        if (waterLevel && waterAmount) {
            const percentage = (this.healthData.water.daily / this.healthData.water.goal) * 100;
            waterLevel.style.height = Math.min(percentage, 100) + '%';
            
            const mlPerGlass = 250;
            const currentMl = this.healthData.water.daily * mlPerGlass;
            const goalMl = this.healthData.water.goal * mlPerGlass;
            waterAmount.textContent = `${currentMl}ml / ${goalMl}ml`;
        }
    }

    updateVitalsHistory() {
        const historyEl = document.getElementById('vitalsHistory');
        if (!historyEl) return;
        
        const recentBP = this.healthData.bloodPressure.slice(-30);
        const recentBS = this.healthData.bloodSugar.slice(-30);
        
        historyEl.innerHTML = `
            <div style="margin-top: 2rem;">
                <h4 style="color: #667eea; margin-bottom: 1rem; display: flex; align-items: center;">
                    <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>
                    혈압 캘린더
                </h4>
                ${this.generateVitalsCalendar(recentBP, 'bloodPressure')}
            </div>
            
            <div style="margin-top: 2rem;">
                <h4 style="color: #667eea; margin-bottom: 1rem; display: flex; align-items: center;">
                    <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>
                    혈당 캘린더
                </h4>
                ${this.generateVitalsCalendar(recentBS, 'bloodSugar')}
            </div>
        `;
    }

    // 혈압/혈당 캘린더 생성
    generateVitalsCalendar(vitalsData, type) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const vitalsMap = new Map();
        vitalsData.forEach(vital => {
            const date = new Date(vital.timestamp).toDateString();
            if (!vitalsMap.has(date)) {
                vitalsMap.set(date, []);
            }
            vitalsMap.get(date).push(vital);
        });
        
        let calendar = `
            <div class="vitals-calendar" style="background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div class="calendar-header" style="text-align: center; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: #2d3748;">
                    ${year}년 ${month + 1}월
                </div>
                <div class="calendar-weekdays" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 0.5rem;">
        `;
        
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        weekdays.forEach(day => {
            calendar += `<div style="text-align: center; padding: 0.5rem; font-weight: 600; color: #666; font-size: 0.9rem;">${day}</div>`;
        });
        
        calendar += '</div><div class="calendar-days" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">';
        
        for (let date = new Date(startDate); date <= lastDay; date.setDate(date.getDate() + 1)) {
            const dateKey = date.toDateString();
            const vitals = vitalsMap.get(dateKey) || [];
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.toDateString() === today.toDateString();
            
            let dayContent = '';
            let backgroundColor = isCurrentMonth ? '#f7fafc' : '#f1f5f9';
            let emoji = '';
            let vitalInfo = '';
            
            if (vitals.length > 0 && isCurrentMonth) {
                const latestVital = vitals[vitals.length - 1]; // 가장 최근 기록
                
                if (type === 'bloodPressure') {
                    const { systolic, diastolic } = latestVital;
                    if (systolic >= 180 || diastolic >= 120) {
                        emoji = '🚨'; backgroundColor = '#fed7d7';
                    } else if (systolic >= 160 || diastolic >= 100) {
                        emoji = '⚠️'; backgroundColor = '#fed7d7';
                    } else if (systolic >= 140 || diastolic >= 90) {
                        emoji = '📈'; backgroundColor = '#fefcbf';
                    } else if (systolic >= 130 || diastolic >= 85) {
                        emoji = '⚡'; backgroundColor = '#fefcbf';
                    } else if (systolic >= 90 && diastolic >= 60) {
                        emoji = '😊'; backgroundColor = '#c6f6d5';
                    } else if (systolic >= 80 && diastolic >= 50) {
                        emoji = '📉'; backgroundColor = '#bee3f8';
                    } else {
                        emoji = '🩸'; backgroundColor = '#fed7d7';
                    }
                    vitalInfo = `${systolic}/${diastolic}`;
                } else { // bloodSugar
                    const value = latestVital.value;
                    if (value < 54) {
                        emoji = '🚨'; backgroundColor = '#fed7d7';
                    } else if (value < 70) {
                        emoji = '📉'; backgroundColor = '#bee3f8';
                    } else if (value <= 99) {
                        emoji = '😊'; backgroundColor = '#c6f6d5';
                    } else if (value <= 125) {
                        emoji = '⚡'; backgroundColor = '#fefcbf';
                    } else if (value <= 199) {
                        emoji = '📈'; backgroundColor = '#fefcbf';
                    } else if (value <= 300) {
                        emoji = '⚠️'; backgroundColor = '#fed7d7';
                    } else {
                        emoji = '🚨'; backgroundColor = '#fed7d7';
                    }
                    vitalInfo = `${value}`;
                }
            }
            
            if (isToday) {
                backgroundColor = '#e6fffa';
            }
            
            dayContent = `
                <div style="
                    background: ${backgroundColor}; 
                    padding: 0.5rem; 
                    border-radius: 6px; 
                    text-align: center; 
                    min-height: 60px;
                    border: ${isToday ? '2px solid #38b2ac' : 'none'};
                    opacity: ${isCurrentMonth ? '1' : '0.3'};
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                ">
                    <div style="font-size: 0.8rem; font-weight: 600; color: #2d3748;">${date.getDate()}</div>
                    ${emoji ? `<div style="font-size: 1.2rem; margin: 2px 0;">${emoji}</div>` : ''}
                    ${vitalInfo ? `<div style="font-size: 0.7rem; color: #4a5568; font-weight: 600;">${vitalInfo}</div>` : ''}
                    ${vitals.length > 1 ? `<div style="font-size: 0.6rem; color: #666;">+${vitals.length - 1}</div>` : ''}
                </div>
            `;
            
            calendar += dayContent;
        }
        
        let legend = '';
        if (type === 'bloodPressure') {
            legend = `
                <div style="display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.8rem;">
                    <span>🚨 위험 (180/120+)</span>
                    <span>⚠️ 고혈압2 (160/100+)</span>
                    <span>📈 고혈압1 (140/90+)</span>
                    <span>⚡ 주의 (130/85+)</span>
                    <span>😊 정상 (90-129/60-84)</span>
                    <span>📉 저혈압 (80-89/50-59)</span>
                    <span>🩸 위험저혈압 (80/50-)</span>
                </div>
            `;
        } else {
            legend = `
                <div style="display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.8rem;">
                    <span>🚨 위험 (54- or 300+)</span>
                    <span>📉 저혈당 (54-69)</span>
                    <span>😊 정상 (70-99)</span>
                    <span>⚡ 주의 (100-125)</span>
                    <span>📈 당뇨의심 (126-199)</span>
                    <span>⚠️ 고혈당 (200-300)</span>
                </div>
            `;
        }
        
        calendar += `
                </div>
                <div class="calendar-legend" style="margin-top: 1rem; padding: 1rem; background: #f7fafc; border-radius: 8px;">
                    <div style="font-size: 0.9rem; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem;">${type === 'bloodPressure' ? '혈압' : '혈당'} 상태 범례:</div>
                    ${legend}
                </div>
            </div>
        `;
        
        return calendar;
    }

    // 탭 관련 메서드들
    showHealthTab(tabName) {
        // 모든 탭 버튼 비활성화
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // 선택된 탭 활성화
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // 탭별 초기화
        if (tabName === 'water') {
            this.updateWaterDisplay();
        } else if (tabName === 'sleep') {
            this.updateSleepChart();
        } else if (tabName === 'vitals') {
            this.updateVitalsHistory();
        }
    }

    updateHealthTabs() {
        this.updateWaterDisplay();
        this.updateSleepChart();
        this.updateVitalsHistory();
    }

    // 수면 차트 업데이트 (캘린더 형식)
    updateSleepChart() {
        const sleepChart = document.getElementById('sleepChart');
        if (!sleepChart) return;
        
        const recentSleep = this.healthData.sleep.slice(-30); // 최근 30일
        
        sleepChart.innerHTML = `
            <h4 style="color: #667eea; margin-bottom: 1rem; display: flex; align-items: center;">
                <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>
                수면 캘린더
            </h4>
            ${this.generateSleepCalendar(recentSleep)}
        `;
    }

    // 수면 캘린더 생성
    generateSleepCalendar(sleepData) {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const sleepMap = new Map();
        sleepData.forEach(sleep => {
            const date = new Date(sleep.timestamp).toDateString();
            sleepMap.set(date, sleep);
        });
        
        let calendar = `
            <div class="sleep-calendar" style="background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div class="calendar-header" style="text-align: center; margin-bottom: 1rem; font-size: 1.1rem; font-weight: 600; color: #2d3748;">
                    ${year}년 ${month + 1}월
                </div>
                <div class="calendar-weekdays" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 0.5rem;">
        `;
        
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        weekdays.forEach(day => {
            calendar += `<div style="text-align: center; padding: 0.5rem; font-weight: 600; color: #666; font-size: 0.9rem;">${day}</div>`;
        });
        
        calendar += '</div><div class="calendar-days" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">';
        
        for (let date = new Date(startDate); date <= lastDay; date.setDate(date.getDate() + 1)) {
            const dateKey = date.toDateString();
            const sleep = sleepMap.get(dateKey);
            const isCurrentMonth = date.getMonth() === month;
            const isToday = date.toDateString() === today.toDateString();
            
            let dayContent = '';
            let backgroundColor = isCurrentMonth ? '#f7fafc' : '#f1f5f9';
            let emoji = '';
            let sleepInfo = '';
            
            if (sleep && isCurrentMonth) {
                const hours = sleep.hours;
                if (hours >= 8.5) {
                    emoji = '😴'; // 과다수면
                    backgroundColor = '#fed7d7';
                } else if (hours >= 7 && hours < 8.5) {
                    emoji = '😊'; // 적정수면
                    backgroundColor = '#c6f6d5';
                } else if (hours >= 5 && hours < 7) {
                    emoji = '😪'; // 수면부족
                    backgroundColor = '#fefcbf';
                } else {
                    emoji = '😵'; // 심각한 수면부족
                    backgroundColor = '#fed7d7';
                }
                sleepInfo = `${hours}h`;
            }
            
            if (isToday) {
                backgroundColor = '#e6fffa';
            }
            
            dayContent = `
                <div style="
                    background: ${backgroundColor}; 
                    padding: 0.5rem; 
                    border-radius: 6px; 
                    text-align: center; 
                    min-height: 50px;
                    border: ${isToday ? '2px solid #38b2ac' : 'none'};
                    opacity: ${isCurrentMonth ? '1' : '0.3'};
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                ">
                    <div style="font-size: 0.8rem; font-weight: 600; color: #2d3748;">${date.getDate()}</div>
                    ${emoji ? `<div style="font-size: 1.2rem; margin: 2px 0;">${emoji}</div>` : ''}
                    ${sleepInfo ? `<div style="font-size: 0.7rem; color: #4a5568; font-weight: 600;">${sleepInfo}</div>` : ''}
                </div>
            `;
            
            calendar += dayContent;
        }
        
        calendar += `
                </div>
                <div class="calendar-legend" style="margin-top: 1rem; padding: 1rem; background: #f7fafc; border-radius: 8px;">
                    <div style="font-size: 0.9rem; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem;">수면 상태 범례:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.8rem;">
                        <span>😴 과다수면 (8.5h+)</span>
                        <span>😊 적정수면 (7-8.5h)</span>
                        <span>😪 수면부족 (5-7h)</span>
                        <span>😵 심각부족 (5h미만)</span>
                    </div>
                </div>
            </div>
        `;
        
        return calendar;
    }

    // 모달 관련 메서드들
    showVoiceModal() {
        document.getElementById('voiceModal').classList.add('active');
    }

    hideVoiceModal() {
        document.getElementById('voiceModal').classList.remove('active');
    }

    updateVoiceText(text) {
        document.getElementById('voiceText').textContent = text;
    }

    showMedicationModal() {
        document.getElementById('medicationModal').classList.add('active');
        this.updateTimeInputs(1); // 기본값: 하루 1회
    }

    hideMedicationModal() {
        document.getElementById('medicationModal').classList.remove('active');
        document.getElementById('medicationForm').reset();
        
        // 수정 모드 초기화
        this.currentEditingMedicationId = null;
        document.querySelector('#medicationModal .modal-header h3').textContent = '약물 추가';
        document.querySelector('#medicationForm button[type="submit"]').innerHTML = '추가';
    }

    updateTimeInputs(frequency) {
        const timesContainer = document.getElementById('medicationTimes');
        timesContainer.innerHTML = '';
        
        const defaultTimes = {
            1: ['09:00'],
            2: ['09:00', '21:00'],
            3: ['08:00', '13:00', '19:00']
        };
        
        const times = defaultTimes[frequency] || ['09:00'];
        
        times.forEach((time, index) => {
            const timeInput = document.createElement('div');
            timeInput.className = 'time-input';
            timeInput.innerHTML = `
                <input type="time" value="${time}" required>
                ${times.length > 1 ? `<button type="button" onclick="this.parentElement.remove()">삭제</button>` : ''}
            `;
            timesContainer.appendChild(timeInput);
        });
    }

    addMedication(e) {
        e.preventDefault();
        
        const name = document.getElementById('medicationName').value;
        const dosage = document.getElementById('medicationDosage').value;
        const frequency = document.getElementById('medicationFrequency').value;
        const times = Array.from(document.querySelectorAll('#medicationTimes input[type="time"]'))
                          .map(input => input.value)
                          .filter(time => time);
        
        if (name && times.length > 0) {
            if (this.currentEditingMedicationId) {
                // 기존 약물 수정
                const medication = this.medications.find(med => med.id === this.currentEditingMedicationId);
                if (medication) {
                    medication.name = name;
                    medication.dosage = dosage;
                    medication.frequency = parseInt(frequency);
                    medication.times = times;
                    
                    this.saveMedications();
                    this.hideMedicationModal();
                    this.updateDashboard();
                    this.renderMedicationList();
                    this.showToast('💊 약물이 수정되었습니다!', 'success');
                    this.speak(`${name} 약물 정보가 수정되었습니다.`);
                }
                this.currentEditingMedicationId = null;
            } else {
                // 새 약물 추가
                const medication = {
                    id: Date.now(),
                    name: name,
                    dosage: dosage,
                    frequency: parseInt(frequency),
                    times: times,
                    takenDates: {}
                };
                
                this.medications.push(medication);
                this.saveMedications();
                this.hideMedicationModal();
                this.updateDashboard();
                this.renderMedicationList();
                this.showToast('💊 약물이 추가되었습니다!', 'success');
                this.speak(`${name} 약물이 추가되었습니다. 복약 시간을 잊지 마세요.`);
            }
        }
    }

    renderMedicationList() {
        const listEl = document.getElementById('medicationList');
        if (!listEl) return;
        
        listEl.innerHTML = this.medications.map(med => `
            <div class="medication-card">
                <h4>${med.name}</h4>
                <div class="medication-details">
                    복용량: ${med.dosage} | 하루 ${med.frequency}회
                </div>
                <div class="medication-times">
                    ${med.times.map(time => `<span class="time-badge">${time}</span>`).join('')}
                </div>
                <div class="medication-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="healthVoice.editMedication(${med.id})">
                        <i class="fas fa-edit"></i> 수정
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="healthVoice.removeMedication(${med.id})">
                        <i class="fas fa-trash"></i> 삭제
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderMedicationSchedule() {
        const scheduleEl = document.getElementById('medicationSchedule');
        if (!scheduleEl) return;
        
        const todayMedications = this.getTodayMedications();
        
        scheduleEl.innerHTML = todayMedications.map(med => `
            <div class="timeline-item ${med.taken ? 'completed' : ''}">
                <div class="timeline-time">${med.time}</div>
                <div class="timeline-medication">${med.name}</div>
            </div>
        `).join('');
    }

    editMedication(id) {
        const medication = this.medications.find(med => med.id === id);
        if (!medication) return;
        
        // 현재 약물 정보로 모달 채우기
        this.currentEditingMedicationId = id;
        document.getElementById('medicationName').value = medication.name;
        document.getElementById('medicationDosage').value = medication.dosage;
        document.getElementById('medicationFrequency').value = medication.frequency;
        
        // 복용 시간들 설정
        this.updateTimeInputs(medication.frequency);
        const timeInputs = document.querySelectorAll('#medicationTimes input[type="time"]');
        medication.times.forEach((time, index) => {
            if (timeInputs[index]) {
                timeInputs[index].value = time;
            }
        });
        
        // 모달 제목 변경
        document.querySelector('#medicationModal .modal-header h3').textContent = '약물 수정';
        
        // 버튼 텍스트 변경
        document.querySelector('#medicationForm button[type="submit"]').innerHTML = '수정';
        
        this.showMedicationModal();
    }

    removeMedication(id) {
        if (confirm('이 약물을 삭제하시겠습니까?')) {
            this.medications = this.medications.filter(med => med.id !== id);
            this.saveMedications();
            this.renderMedicationList();
            this.updateDashboard();
            this.showToast('약물이 삭제되었습니다.', 'info');
        }
    }

    // 유틸리티 메서드들
    shouldRemindWater() {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 8 && hour <= 22 && this.healthData.water.daily < this.healthData.water.goal;
    }

    showHelp() {
        const helpText = `
        사용 가능한 음성 명령:
        • "약 먹었어요" - 복약 기록
        • "물 마셨어요" - 물 마시기 기록
        • "7시간 잤어요" - 수면 기록
        • "기분 좋아요" - 기분 기록
        • "운동 시작" - 운동 시작
        • "명상" - 명상 시작
        • "혈압 120 80" - 혈압 기록
        `;
        
        this.speak(helpText.replace(/[•\n]/g, ' '));
        this.showToast('음성 명령 도움말을 들려드렸습니다.', 'info');
    }

    handleEmergency() {
        this.speak('응급 상황입니다. 119에 연락하거나 가까운 응급실로 가세요.');
        this.showToast('🚨 응급 상황 - 119에 연락하세요!', 'error');
        
        // 응급 연락처 표시
        if (confirm('119에 전화를 거시겠습니까?')) {
            window.open('tel:119');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const icon = toast.querySelector('.toast-icon');
        const messageEl = toast.querySelector('.toast-message');
        
        // 아이콘 설정
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        icon.className = `toast-icon ${icons[type]}`;
        messageEl.textContent = message;
        toast.className = `toast ${type}`;
        
        // 토스트 표시
        toast.classList.add('show');
        
        // 3초 후 숨기기
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // 데이터 저장/로드 메서드들
    saveMedications() {
        localStorage.setItem('medications', JSON.stringify(this.medications));
    }

    saveHealthData() {
        localStorage.setItem('healthData', JSON.stringify(this.healthData));
    }

    saveExerciseData() {
        localStorage.setItem('exerciseData', JSON.stringify(this.exerciseData));
    }
    
    // 알림 권한 요청
    async requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        this.showToast('🔔 알림이 활성화되었습니다!', 'success');
                        this.speak('알림이 활성화되었습니다. 이제 물 마시기와 약물 복용 알림을 받으실 수 있어요.');
                    } else {
                        this.showToast('⚠️ 알림 권한이 거부되었습니다.', 'warning');
                    }
                } catch (error) {
                    console.error('알림 권한 요청 오류:', error);
                }
            }
        }
    }
    
    // 물 마시기 알림 스케줄 설정 (오전 8시 - 오후 10시, 2시간마다 총 8번)
    setupWaterReminders() {
        const waterTimes = [
            '08:00', '10:00', '12:00', '14:00', 
            '16:00', '18:00', '20:00', '22:00'
        ];
        
        // 1분마다 체크
        setInterval(() => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            if (waterTimes.includes(currentTime)) {
                this.sendWaterReminder();
            }
        }, 60000);
    }
    
    // 물 마시기 알림 전송
    sendWaterReminder() {
        const message = '💧 물 마실 시간입니다! 건강한 수분 섭취를 위해 물 한 잔 드세요.';
        
        // 화면 알림 배너
        this.showToast(message, 'info');
        
        // 음성 안내
        this.speak('물 마실 시간입니다! 건강한 수분 섭취를 위해 물 한 잔 드세요.');
        
        // 브라우저 알림 (권한이 있는 경우)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('HealthVoice - 물 마시기 알림', {
                body: '물 마실 시간입니다! 건강한 수분 섭취를 위해 물 한 잔 드세요.',
                icon: '/icons/icon-144x144.png',
                badge: '/icons/icon-144x144.png',
                tag: 'water-reminder',
                requireInteraction: true
            });
        }
    }
}

// 앱 초기화
let healthVoice;
document.addEventListener('DOMContentLoaded', () => {
    healthVoice = new HealthVoice();
});

// 전역 함수들 (HTML에서 직접 호출)
function startQuickExercise() {
    healthVoice.startQuickExercise();
}
