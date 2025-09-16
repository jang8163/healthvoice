// HealthVoice Service Worker
// PWA 기능 및 오프라인 지원을 위한 서비스 워커

const CACHE_NAME = 'healthvoice-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/demo-data.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap'
];

// 서비스 워커 설치
self.addEventListener('install', (event) => {
    console.log('HealthVoice Service Worker 설치 중...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('캐시 열기 성공');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('캐시 설정 실패:', error);
            })
    );
});

// 서비스 워커 활성화
self.addEventListener('activate', (event) => {
    console.log('HealthVoice Service Worker 활성화');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // 이전 버전의 캐시 삭제
                    if (cacheName !== CACHE_NAME) {
                        console.log('이전 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 네트워크 요청 처리
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 캐시에서 찾으면 반환
                if (response) {
                    return response;
                }
                
                // 네트워크에서 가져오기
                return fetch(event.request)
                    .then((response) => {
                        // 유효한 응답인지 확인
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // 응답을 복제해서 캐시에 저장
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // 네트워크 실패시 오프라인 페이지 또는 기본 응답
                        if (event.request.destination === 'document') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// 푸시 알림 처리
self.addEventListener('push', (event) => {
    console.log('푸시 알림 수신:', event);
    
    const options = {
        body: event.data ? event.data.text() : '건강 관리 알림이 있습니다.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'confirm',
                title: '확인',
                icon: '/icons/icon-72x72.png'
            },
            {
                action: 'dismiss',
                title: '나중에',
                icon: '/icons/icon-72x72.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('HealthVoice', options)
    );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
    console.log('알림 클릭:', event);
    
    event.notification.close();
    
    if (event.action === 'confirm') {
        // 확인 액션
        event.waitUntil(
            clients.openWindow('/?notification=confirm')
        );
    } else if (event.action === 'dismiss') {
        // 나중에 액션
        console.log('알림 연기');
    } else {
        // 기본 클릭
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// 백그라운드 동기화 (복약 알림 등)
self.addEventListener('sync', (event) => {
    if (event.tag === 'medication-reminder') {
        event.waitUntil(
            checkMedicationReminders()
        );
    }
});

// 복약 알림 체크 함수
async function checkMedicationReminders() {
    try {
        // 로컬 스토리지에서 복약 데이터 가져오기
        const medications = JSON.parse(localStorage.getItem('medications') || '[]');
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const today = now.toDateString();
        
        medications.forEach(med => {
            med.times.forEach(time => {
                if (time === currentTime) {
                    // 이미 복용했는지 확인
                    const taken = med.takenDates && 
                                 med.takenDates[today] && 
                                 med.takenDates[today].includes(time);
                    
                    if (!taken) {
                        // 복약 알림 표시
                        self.registration.showNotification('복약 알림', {
                            body: `${med.name} 복용 시간입니다.`,
                            icon: '/icons/icon-192x192.png',
                            badge: '/icons/icon-72x72.png',
                            tag: 'medication',
                            requireInteraction: true,
                            actions: [
                                {
                                    action: 'taken',
                                    title: '복용 완료'
                                },
                                {
                                    action: 'snooze',
                                    title: '10분 후 알림'
                                }
                            ]
                        });
                    }
                }
            });
        });
    } catch (error) {
        console.error('복약 알림 체크 오류:', error);
    }
}

// 메시지 처리 (메인 앱과의 통신)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// 정기적인 건강 알림 스케줄링
function scheduleHealthReminders() {
    // 물 마시기 알림 (매 시간)
    setInterval(() => {
        const now = new Date();
        const hour = now.getHours();
        
        // 오전 8시부터 오후 10시까지만
        if (hour >= 8 && hour <= 22) {
            self.registration.showNotification('수분 섭취 알림', {
                body: '물 마실 시간입니다! 💧',
                icon: '/icons/icon-192x192.png',
                tag: 'water-reminder',
                silent: true
            });
        }
    }, 3600000); // 1시간
    
    // 운동 알림 (하루 2회)
    setInterval(() => {
        const now = new Date();
        const hour = now.getHours();
        
        if (hour === 10 || hour === 16) {
            self.registration.showNotification('운동 알림', {
                body: '잠깐! 스트레칭 시간입니다 🏃‍♀️',
                icon: '/icons/icon-192x192.png',
                tag: 'exercise-reminder',
                actions: [
                    {
                        action: 'start-exercise',
                        title: '운동 시작'
                    },
                    {
                        action: 'later',
                        title: '나중에'
                    }
                ]
            });
        }
    }, 3600000); // 1시간마다 체크
}

// 서비스 워커 시작시 알림 스케줄링
scheduleHealthReminders();
