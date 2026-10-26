    let t1_h = 9, t1_m = 0;
    let t2_h = 21, t2_m = 15;
    
    const MQTT_CLUSTER_URL = "e1befaaf.ala.eu-central-1.emqxsl.com";
    
    const TOPIC_DATA        = "rosliny/pomiary";
    const TOPIC_CONFIG      = "rosliny/konfiguracja";
    const TOPIC_CMD_TRIG    = "rosliny/cmd/trigger";
    const TOPIC_CMD_TARGET  = "rosliny/cmd/target";
    const TOPIC_CMD_TIMES   = "rosliny/cmd/times";

    let client = null;
    let checkConnectionOnNextMsg = false;

    //zegar
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock-display').innerText = now.toLocaleTimeString('pl-PL');
    }, 1000);


    //laczenie z Brokerem (WebSockets)
    function connectToMQTT(username, password)
    {
        const statusEl = document.getElementById('val-status');
        statusEl.innerText = "Łączenie z Brokerem...";
        statusEl.style.color = "orange";

        const brokerUrl = `wss://${MQTT_CLUSTER_URL}:8084/mqtt`;

        client = mqtt.connect(brokerUrl, {
            username: username,
            password: password,
            reconnectPeriod: 5000
        });

        client.on('connect', () => {
            console.log("Połoczono z Brokerem");
            localStorage.setItem('broker_user', username);
            localStorage.setItem('broker_pass', password);

            document.getElementById('log-box').style.display = 'none';
            statusEl.style.color = "green";

            client.subscribe([TOPIC_DATA, TOPIC_CONFIG]);
        });

        client.on('error', (err) => {
            console.error("Bład MQTT", err);
            statusEl.innerText = "Brak połączenia z chmurą!";
            statusEl.style.color = "red";
            document.getElementById('log-box').style.display = 'block';
        });

        client.on('message', (topic, message) => {
            const payload = message.toString();

            //odebranie pomiarow z esp
            if(topic == TOPIC_DATA)
            {
                const data = JSON.parse(payload);
                const statusEl = document.getElementById('val-status');

                if(checkConnectionOnNextMsg || data.conn !== undefined)
                {
                    if(data.conn === 1)
                    {
                        statusEl.innerText = "Poprawna komunikacja UART";
                        statusEl.style.color = "green";
                    }else
                    {
                        statusEl.innerText = "Brak komunikacji z STM32";
                        statusEl.style.color = "red";
                    }
                    checkConnectionOnNextMsg = false;
                }

                //podmiana tekstow na stronie
                document.getElementById('val-temp').innerText = data.temp.toFixed(1);
                document.getElementById('val-hum').innerText = data.hum.toFixed(1);
                document.getElementById('val-tank').innerText = data.tank;
                document.getElementById('val-m1').innerText = data.m1.toFixed(2);
                document.getElementById('val-m2').innerText = data.m2.toFixed(2);
                document.getElementById('val-m3').innerText = data.m3.toFixed(2);
                document.getElementById('val-cnt').innerText = data.cnt;
            }

            //odebranie konfiguracji z esp
            if(topic === TOPIC_CONFIG)
            {
            const data = JSON.parse(payload);
            const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

            document.getElementById('input-time-1').value = formatTime(data.h1, data.m1);
            document.getElementById('input-time-2').value = formatTime(data.h2, data.m2);

            t1_h = data.h1; t1_m = data.m1;
            t2_h = data.h2; t2_m = data.m2;

            document.getElementById('name-m1').innerText = data.n1;
            document.getElementById('name-m2').innerText = data.n2;
            document.getElementById('name-m3').innerText = data.n3;

            //wilgotnosc pusta
            document.getElementById('input-target-m1').value = (data.t1 === 0) ? "" : data.t1;
            document.getElementById('input-target-m2').value = (data.t2 === 0) ? "" : data.t2;
            document.getElementById('input-target-m3').value = (data.t3 === 0) ? "" : data.t3;

            //nazwa rosliny pusta
            document.getElementById('input-name-m1').value = (data.n1 === "Roślina 1") ? "" : data.n1;
            document.getElementById('input-name-m2').value = (data.n2 === "Roślina 2") ? "" : data.n2;
            document.getElementById('input-name-m3').value = (data.n3 === "Roślina 3") ? "" : data.n3;
            }
        });
    }
    

    //altomatyczne logowanie gdy dane zapisane
    const savedUser = localStorage.getItem('broker_user');
    const savedPass = localStorage.getItem('broker_pass');
    if(savedUser && savedPass)
    {
        connectToMQTT(savedUser, savedPass);
    }


    //przycisk logowania 
    document.getElementById('login-btn').addEventListener('click', () => {
        const u = document.getElementById('mqtt-user').value.trim();
        const p = document.getElementById('mqtt-pass').value.trim();
        if(u && p)
        {
            connectToMQTT(u, p);
        }
    });
            
    //zapis godzin z triggerow
    document.getElementById('save-time-btn').addEventListener('click', () => {
        if(!client || !client.connected)
        {
            return alert("Brak połączenia z chmurą!");
        }

        const time1 = document.getElementById('input-time-1').value;
        const time2 = document.getElementById('input-time-2').value;

        if(time1 !== "" && time2 !== "")
        {
            t1_h = parseInt(time1.split(':')[0]);
            t1_m = parseInt(time1.split(':')[1]);
            t2_h = parseInt(time2.split(':')[0]);
            t2_m = parseInt(time2.split(':')[1]);

            //wyslanie danych do esp32
            const msg = `h1=${t1_h}&m1=${t1_m}&h2=${t2_h}&m2=${t2_m}`;
            client.publish(TOPIC_CMD_TIMES, msg);
            alert("Zapisano triggery");
        }
    })


    //zapis nazw/wilgotnosci roslin (przycisk)
    document.getElementById('save-m1-btn').addEventListener('click', () => {
        if(!client || !client.connected)
        {
            return alert("Brak połączenia z chmurą!");
        }

        const name1 = document.getElementById('input-name-m1').value.trim();
        const target1 = document.getElementById('input-target-m1').value;

        const name2 = document.getElementById('input-name-m2').value.trim();
        const target2 = document.getElementById('input-target-m2').value;

        const name3 = document.getElementById('input-name-m3').value.trim();
        const target3 = document.getElementById('input-target-m3').value;

        //gdy pole nazwy puste
        const n1_send = name1 !== "" ? name1 : "Roślina 1";
        const n2_send = name2 !== "" ? name2 : "Roślina 2";
        const n3_send = name3 !== "" ? name3 : "Roślina 3";

        //gdy wilgotnosc pusta
        const t1_send = target1 !== "" ? parseInt(target1) : 0;
        const t2_send = target2 !== "" ? parseInt(target2) : 0;
        const t3_send = target3 !== "" ? parseInt(target3) : 0;

        //zpieranie danych do wyslania 
        let parms = [];
        parms.push(`m1=${t1_send}`);
        parms.push(`m2=${t2_send}`);
        parms.push(`m3=${t3_send}`);
        parms.push(`n1=${n1_send}`);
        parms.push(`n2=${n2_send}`);
        parms.push(`n3=${n3_send}`);

        //zmianna nazwy
        if(name1 !== "") document.getElementById('name-m1').innerText = n1_send;
        if(name2 !== "") document.getElementById('name-m2').innerText = n2_send;
        if(name3 !== "") document.getElementById('name-m3').innerText = n3_send;
        
        if(parms.length > 0)
        {
            client.publish(TOPIC_CMD_TARGET, parms.join('&'));
            alert("Ustawino nowe progi wilgotności");
        }
    });



    //obsluga listy kwiatow
    function setupDatalistSync(nameInputId, targetInputId, datalistId)
    {
        const nameInput = document.getElementById(nameInputId);
        const targetInput  = document.getElementById(targetInputId);
        const datalist = document.getElementById(datalistId);

        nameInput.addEventListener('input', (e) => {
            const val = e.target.value;

            const option = Array.from(datalist.options).find(opt => opt.value === val);

            //dopasowanie wilgotnosci gdy znajdzamy nazwe na liscie 
            if(option)
            {
                const moisture = option.getAttribute('data-moisture');
                if(moisture)
                {
                    targetInput.value = moisture;
                }
            }
        });
    }

    //nasluchiwanie na to wpisujemy
    setupDatalistSync('input-name-m1', 'input-target-m1', 'plant-list');
    setupDatalistSync('input-name-m2', 'input-target-m2', 'plant-list');
    setupDatalistSync('input-name-m3', 'input-target-m3', 'plant-list');



    //przycisk "odswież pomiary"
    document.getElementById('trigger-btn').addEventListener('click', () => {
    if(!client || !client.connected) return alert("Brak połączenia z chmurą!");

    const statusEl = document.getElementById('val-status');
    statusEl.innerText = "Sprawdzanie...";
    statusEl.style.color = "orange";

    checkConnectionOnNextMsg = true;
    client.publish(TOPIC_CMD_TRIG, "1");
    });

    

    