// HealthVoice - 데모 데이터
// 앱 테스트 및 시연을 위한 샘플 데이터

class DemoData {
    static loadSampleData() {
        // 샘플 약물 데이터
        const sampleMedications = [
            {
                id: 1,
                name: "혈압약",
                dosage: "1정",
                frequency: 2,
                times: ["08:00", "20:00"],
                takenDates: {}
            },
            {
                id: 2,
                name: "비타민 D",
                dosage: "1정",
                frequency: 1,
                times: ["09:00"],
                takenDates: {}
            },
            {
                id: 3,
                name: "오메가3",
                dosage: "1캡슐",
                frequency: 1,
                times: ["21:00"],
                takenDates: {}
            }
        ];

        // 샘플 건강 데이터
        const sampleHealthData = {
            water: {
                daily: 3,
                goal: 8,
                lastReset: new Date().toDateString()
            },
            sleep: [
                {
                    date: new Date(Date.now() - 86400000).toDateString(),
                    hours: 7.5,
                    timestamp: Date.now() - 86400000
                },
                {
                    date: new Date(Date.now() - 172800000).toDateString(),
                    hours: 6.5,
                    timestamp: Date.now() - 172800000
                }
            ],
            bloodPressure: [
                {
                    date: new Date().toDateString(),
                    systolic: 120,
                    diastolic: 80,
                    timestamp: Date.now()
                },
                {
                    date: new Date(Date.now() - 86400000).toDateString(),
                    systolic: 125,
                    diastolic: 85,
                    timestamp: Date.now() - 86400000
                }
            ],
            bloodSugar: [
                {
                    date: new Date().toDateString(),
                    value: 95,
                    timestamp: Date.now()
                }
            ],
            mood: [
                {
                    date: new Date().toDateString(),
                    mood: 'happy',
                    note: '오늘은 기분이 좋은 하루였습니다!',
                    timestamp: Date.now()
                }
            ]
        };

        // 샘플 운동 데이터
        const sampleExerciseData = [
            {
                date: new Date().toDateString(),
                duration: 15,
                type: 'stretch',
                timestamp: Date.now() - 3600000
            }
        ];

        return {
            medications: sampleMedications,
            healthData: sampleHealthData,
            exerciseData: sampleExerciseData
        };
    }

    static initializeSampleData() {
        const sampleData = this.loadSampleData();
        
        // 기존 데이터가 없거나 데모 모드일 때만 샘플 데이터 로드
        if (!localStorage.getItem('medications') || localStorage.getItem('demoMode') === 'true') {
            localStorage.setItem('medications', JSON.stringify(sampleData.medications));
        }
        
        if (!localStorage.getItem('healthData') || localStorage.getItem('demoMode') === 'true') {
            localStorage.setItem('healthData', JSON.stringify(sampleData.healthData));
        }
        
        if (!localStorage.getItem('exerciseData') || localStorage.getItem('demoMode') === 'true') {
            localStorage.setItem('exerciseData', JSON.stringify(sampleData.exerciseData));
        }
        
        // 데모 모드 설정
        localStorage.setItem('demoMode', 'true');
        
        console.log('샘플 데이터가 로드되었습니다.');
    }

    static clearAllData() {
        localStorage.removeItem('medications');
        localStorage.removeItem('healthData');
        localStorage.removeItem('exerciseData');
        localStorage.removeItem('demoMode');
        console.log('모든 데이터가 삭제되었습니다.');
        location.reload();
    }

    static exportData() {
        const data = {
            medications: JSON.parse(localStorage.getItem('medications') || '[]'),
            healthData: JSON.parse(localStorage.getItem('healthData') || '{}'),
            exerciseData: JSON.parse(localStorage.getItem('exerciseData') || '[]'),
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `healthvoice-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    static importData(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.medications) {
                    localStorage.setItem('medications', JSON.stringify(data.medications));
                }
                if (data.healthData) {
                    localStorage.setItem('healthData', JSON.stringify(data.healthData));
                }
                if (data.exerciseData) {
                    localStorage.setItem('exerciseData', JSON.stringify(data.exerciseData));
                }
                
                alert('데이터가 성공적으로 가져와졌습니다.');
                location.reload();
            } catch (error) {
                alert('데이터 파일을 읽는 중 오류가 발생했습니다.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    }
}

// 페이지 로드시 샘플 데이터 초기화 (선택사항)
// 실제 배포시에는 이 부분을 제거하고 사용자가 직접 데이터를 입력하도록 할 수 있습니다.
document.addEventListener('DOMContentLoaded', () => {
    // URL 파라미터로 데모 모드 확인
    const urlParams = new URLSearchParams(window.location.search);
    const isDemoMode = urlParams.get('demo') === 'true';
    
    if (isDemoMode) {
        DemoData.initializeSampleData();
    }
});

// 개발자 도구용 전역 함수들
window.HealthVoiceDemo = {
    loadSampleData: () => DemoData.initializeSampleData(),
    clearData: () => DemoData.clearAllData(),
    exportData: () => DemoData.exportData(),
    importData: (file) => DemoData.importData(file)
};
