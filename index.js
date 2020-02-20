const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('axios');
const GoogleSpreadsheet = require('google-spreadsheet');
const credentials = require('./cred.json'); // to access Google Sheet
const { promisify } = require('util');
const lodash = require('lodash');

const port = 3001;

// configuration
const botToken = 'token';
const adminId = 00000;
const group_id = -00000;
const test_group_id = -0000;
const SPREADSHEET_ID = 'id';
var employeeSheet;
var sharingSessionSheet;
var cohesionSheet;

const months = {
  jan: 1, feb: 2, mar: 3,
  apr: 4, mei: 5, jun: 6, jul: 7,
  agu: 8, sep: 9, okt: 10, nov: 11,
  des: 12
};
staffs = [
  {
    id: 332240864,
    username: 'galihsantos',
    nickname: 'Galih',
    friendly: 'Galih',
    shout: 'Lih',
    birthdate: new Date(1986, 10, 17)
  },
  {
    username: 'AnisaAT',
    nickname: 'Anisa',
    friendly: 'Nisa',
    shout: 'Nis',
    birthdate: new Date(1988, 5, 1)
  },
  {
    username: 'dnbakti',
    nickname: 'Dadan',
    friendly: 'Dadan',
    shout: 'Dan',
    birthdate: new Date(1988, 6, 10)
  },
  {
    id: 37097496,
    username: 'artsikey',
    nickname: 'Prizka',
    friendly: 'Ikey',
    shout: 'Key',
    birthdate: new Date(1989, 9, 2)
  },
  {
    username: 'anggawicaksono',
    nickname: 'Angga',
    friendly: 'Angga',
    shout: 'Ga',
    birthdate: new Date(1991, 5, 24)
  },
  {
    username: 'FendyRiwan',
    nickname: 'Fendy',
    friendly: 'Fendy',
    shout: 'Fen',
    birthdate: new Date(1988, 4, 12)
  },
  {
    username: 'mkurniawan013',
    nickname: 'Wawan',
    friendly: 'Wawan',
    shout: 'Wan',
    birthdate: new Date(1992, 7, 13)
  },
  {
    id: 130115437,
    username: 'dwikki',
    nickname: 'Dwiki',
    friendly: 'Dwiki',
    shout: 'Ki',
    birthdate: new Date(1994, 10, 23)
  },
  {
    username: 'Isepsihab',
    nickname: 'Isep',
    friendly: 'Isep',
    shout: 'Sep',
    birthdate: new Date(1988, 1, 12)
  }
];

app.use(bodyParser.json());

// functions
const reply = async (data) => {
  try {
    await request.post(`https://api.telegram.org/bot${botToken}/sendMessage`, data);
  } catch (err) {
    console.log(err);
  }
};
const handleMessage = (data) => {
  const chatId = data.message.chat.id;
  try {
    const menu = data.message.text.split('/')[1];
    if (menu === 'sharing') {
      const submenus = [{
        text: 'Semua Jadwal',
        callback_data: 'schedules'
      },
      {
        text: 'Jadwal Minggu ini',
        callback_data: 'nextschedule'
      },
      {
        text: 'Jadwal Saya',
        callback_data: 'myschedule'
      }
      ];

      reply({
        chat_id: chatId,
        text: 'Sharing Session',
        reply_markup: JSON.stringify({
          'inline_keyboard': [submenus]
        })
      })
    }
  } catch (err) {
    console.log(err);
  }
};

// drive connector
const connectGoogleSheet = async () => {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  await promisify(doc.useServiceAccountAuth)(credentials);
  const info = await promisify(doc.getInfo)();
  console.log('Loaded doc: ' + info.title + ' by ' + info.author.email);
  employeeSheet = info.worksheets[0];
  sharingSessionSheet = info.worksheets[1];
  cohesionSheet = info.worksheets[2];
  console.log('sheet 1: ' + employeeSheet.title);
  console.log('sheet 2: ' + sharingSessionSheet.title);
  console.log('sheet 3: ' + cohesionSheet.title);
};

const getSchedules = async () => {
  const rows = await promisify(sheet.getRows)(1);
  const upcomingSessions = rows.reduce((result, row) => {
    const startDate = parseStartDate(row.week);
    if (onSchedule(startDate)) {
      result.push({
        week: row.week,
        presenter: row.presenter,
        topic: row.topik
      });
    }
    return result;
  }, []);
  return upcomingSessions;
};

const getScheduleByPresenter = async (nickname) => {
  const rows = await promisify(sheet.getRows)(1);
  return rows.find((row) => {
    const startDate = parseStartDate(row.week);
    return onSchedule(startDate) && row.presenter === nickname;
  });
};

// routes
const handleSubmenu = async (data) => {
  const submenu = data.callback_query.data;
  const chatId = data.callback_query.message.chat.id;
  const username = data.callback_query.from.username;
  const replyMessage = {
    'chat_id': chatId,
    'text': '',
    'parse_mode': 'Markdown'
  }

  if (submenu === 'schedules') {
    const schedules = await getSchedules();
    const message = schedules.reduce((m, sch) => {
      return m + `${sch.week} : ${sch.presenter}\n`;
    }, '');
    replyMessage.text = '```\n' + message + '```';
    reply(replyMessage);
  } else if (submenu === 'myschedule') {
    const staff = findStaff('username', username);
    const schedule = await getScheduleByPresenter(staff.nickname);
    const message = `Sharing session Kak ${staff.friendly} selanjutnya: ${schedule.week}`;
    replyMessage.text = message;
    reply(replyMessage);
  } else if (submenu === 'nextschedule') {
    const schedule = await getNextSchedule();
    const message = `Jadwal sharing session minggu ini: Kak ${schedule.presenter}`;
    replyMessage.text = message;
    reply(replyMessage);
  }
};

const parseStartDate = (dateStr) => {
  const dateList = dateStr.split(' ');
  const month = months[dateList[0].toLowerCase()];
  const day = parseInt(dateList[1], 10);
  return new Date(2019, month - 1, day);
};

const onSchedule = (startDate) => {
  if (!(startDate instanceof Date) || isNaN(startDate)) {
    return false;
  }
  const today = new Date();
  startDate.setDate(startDate.getDate() + 4);
  return startDate >= today;
};

const isStaff = (username) => {
  const staff = findStaff('username', username);
  return staff ? true : false;
};

const generateRandomHBD = (staff) => {
  const messages = [
    `Cieee Kak ${staff.friendly} ulang tahun. Traktir-traktir atuh, ${staff.shout} :D`,
    `Wilujeng tepang taun Kak ${staff.friendly}... Mugia aya dina kasehatan, kabagjaan, runtut raut rumah tanggana sinareng digampangkeun rejekina`,
    `Met ultah Kak ${staff.friendly}. Aku jangan dibully terus ya hiks`
  ];
  const selected = Math.floor(Math.random() * 3);
  return `${messages[selected]}\n\ncc @${staff.username}`;
};

app.get('/siom/data/employee', async (req, res) => {
  const rows = await promisify(employeeSheet.getRows)(1);
  var jsonObject = {};
  var key = 'detail';
  jsonObject[key] = [];
  for (var i = 0; i < rows.length; i++) {
    var details = {
      "id": rows[i].id,
      "username": rows[i].username,
      "nickname": rows[i].nickname,
      "friendly": rows[i].friendly,
      "shout": rows[i].shout,
      "birthdate": rows[i].birthdate
    };
    jsonObject[key].push(details);
  }

  return res.json({
    success: true,
    code: 200,
    data: jsonObject
  });
})
app.get('/siom/data/sharingsession', async (req, res) => {
  const rows = await promisify(sharingSessionSheet.getRows)(1);
  var jsonObject = {};
  var key = 'detail';
  jsonObject[key] = [];
  for (var i = 0; i < rows.length; i++) {
    var details = {
      "No": rows[i].no,
      "Start": rows[i].start,
      "End": rows[i].end,
      "Member": rows[i].member,
      "Topic": rows[i].topic
    };
    jsonObject[key].push(details);
  }

  return res.json({
    success: true,
    code: 200,
    data: jsonObject
  });
})

app.get('/siom/data/cohesion', async (req, res) => {
  const rows = await promisify(cohesionSheet.getRows)(1);
  var jsonObject = {};
  var key = 'detail';
  jsonObject[key] = [];
  for (var i = 0; i < rows.length; i++) {
    var details = {
      "No": rows[i].no,
      "Month": rows[i].month,
      "Member": rows[i].member
    };
    jsonObject[key].push(details);
  }

  return res.json({
    success: true,
    code: 200,
    data: jsonObject
  });
})

// reminder who birthday today
const getEmployeeBirthday = async (findSheet, key) => {
  const today = new Date();
  const rows = await promisify(findSheet.getRows)(1);
  return rows.filter((row) => {
    const startDate = new Date(row[key]);
    return today.getMonth() === startDate.getMonth() && today.getDate() === startDate.getDate();
  });
}

app.get('/siom/birthday', async (req, res) => {
  const employee = await getEmployeeBirthday(employeeSheet, 'birthdate');

  if (typeof employee != 'undefined' && employee != null) {
    //do stuff if query is defined and not null
    var message = 'Woi';
    for (var i = 0; i < employee.length; i++) {

      // push to telegram
      message = generateRandomHBD(employee[i]);
      reply({
        chat_id: group_id,
        text: message
      })

    }

    return res.json({
      success: true,
      code: 200,
      text: message
    });
  }
  else {
    return res.json({
      success: false,
      code: 400,
      msg: 'there are no employee birthday today'
    });
  }
})


//Reminder sharing session
function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  // Return array of year and week number
  return [d.getUTCFullYear(), weekNo];
}
const getNextSchedule = async () => {
  const today = new Date();
  const rows = await promisify(sharingSessionSheet.getRows)(1);
  return rows.find((row) => {
    const startDate = new Date(row.start);
    return getWeekNumber(today)[1] == getWeekNumber(startDate)[1];
  });
}

const findStaff = (rows, key, value) => {
  return rows.find(row => row[key] === value);
};

app.get('/siom/reminder', async (req, res) => {
  const schedule = await getNextSchedule();
  const employees = await promisify(employeeSheet.getRows)(1);
  // console.log(schedule);
  const staff = findStaff(employees, 'nickname', schedule.member);
  if (typeof staff != 'undefined' && staff != null) {
    // console.log(staff)
    const cc = staff.username ? `\n\ncc @${staff.username}` : '';
    const message = `Jangan lupa ya kakak-kakak, jadwal sharing session minggu ini: Kak ${schedule.member}${cc}`;
    reply({
      chat_id: group_id,
      text: message
    });
    return res.json({
      success: true,
      code: 200,
      text: message
    });
  } else {
    return res.json({
      success: false,
      code: 400,
      msg: 'there are no employee sharing session today'
    });
  }

});


// Reminder Cohesion
const getCohesionSch = async () => {
  const today = new Date();
  const rows = await promisify(cohesionSheet.getRows)(1);
  return rows.find((row) => {
    const month = new Date(row.month);
    return today.getMonth() === month.getMonth();
  });
}

app.get('/siom/cohesion', async (req, res) => {
  const schedule = await getCohesionSch();
  const employees = await promisify(employeeSheet.getRows)(1);
  console.log(schedule);
  const staff = findStaff(employees, 'nickname', schedule.member);
  if (typeof staff != 'undefined' && staff != null) {
    // console.log(staff)
    const cc = staff.username ? `\n\ncc @${staff.username}` : '';
    const message = `Asyik kohesi kita bulan ini, colek Kak ${schedule.member}${cc}`;
    if (schedule.status != 'Done') {
      reply({
        chat_id: group_id,
        text: message
      });
    }
    return res.json({
      success: true,
      code: 200,
      text: message
    });
  } else {
    return res.json({
      success: false,
      code: 400,
      msg: 'there are no employee sharing session today'
    });
  }

});

// run app
connectGoogleSheet();
app.listen(port, () => console.log(`Server is listening on port ${port}`));
