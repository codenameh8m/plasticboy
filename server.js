// Функция проверки админского пароля - ИСПРАВЛЕНА
function checkAdminPassword(req) {
    // Проверяем разные способы передачи пароля
    let password = null;
    
    // 1. Заголовок Authorization
    if (req.headers.authorization) {
        password = req.headers.authorization;
    }
    
    // 2. Заголовок X-Admin-Password (с декодированием)
    if (!password && req.headers['x-admin-password']) {
        password = decodeURIComponent(req.headers['x-admin-password']);
    }
    
    // 3. Fallback для старых версий
    if (!password && req.get('Authorization')) {
        password = req.get('Authorization');
    }
    
    console.log('🔑 Проверка админского пароля...');
    console.log('   📋 Authorization header:', req.headers.authorization ? 'есть' : 'нет');
    console.log('   📋 X-Admin-Password header:', req.headers['x-admin-password'] ? 'есть' : 'нет');
    console.log('   🎯 Найденный пароль:', password ? 'найден' : 'не найден');
    console.log('   ✅ Ожидаемый пароль:', process.env.ADMIN_PASSWORD ? 'установлен' : 'не установлен');
    
    const isValid = password && password === process.env.ADMIN_PASSWORD;
    console.log('   🔐 Результат проверки:', isValid ? 'УСПЕХ' : 'ОШИБКА');
    
    return isValid;
}

// Получить все точки для админа - ИСПРАВЛЕНО
app.get('/api/admin/points', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_ACCESS_DENIED', { 
        ip: req.ip,
        headers: {
          authorization: req.headers.authorization ? 'present' : 'missing',
          xAdminPassword: req.headers['x-admin-password'] ? 'present' : 'missing'
        }
      }, req);
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    const points = await ModelPoint.find({}).lean().exec();
    
    logUserAction('ADMIN_POINTS_LOADED', { count: points.length }, req);
    console.log(`🛡️ Админ загрузил ${points.length} точек`);
    
    res.json(points);
  } catch (error) {
    console.error('❌ Ошибка загрузки точек для админа:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Создать новую точку (админ) - ИСПРАВЛЕНО
app.post('/api/admin/points', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_CREATE_DENIED', { 
        ip: req.ip,
        headers: {
          authorization: req.headers.authorization ? 'present' : 'missing',
          xAdminPassword: req.headers['x-admin-password'] ? 'present' : 'missing'
        }
      }, req);
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const { name, coordinates, delayMinutes } = req.body;
    
    // Валидация данных
    if (!name || !coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return res.status(400).json({ error: 'Invalid point data' });
    }

    const pointId = Date.now().toString();
    const qrSecret = crypto.randomBytes(16).toString('hex');
    
    const scheduledTime = new Date();
    if (delayMinutes && !isNaN(delayMinutes)) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    // Создаем URL для сканирования QR кода
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Генерируем QR код
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    const newPoint = new ModelPoint({
      id: pointId,
      name: name.trim(),
      coordinates: {
        lat: parseFloat(coordinates.lat),
        lng: parseFloat(coordinates.lng)
      },
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime
    });

    await newPoint.save();
    
    logUserAction('ADMIN_POINT_CREATED', { 
      pointId, 
      name: name.trim(),
      scheduledTime: scheduledTime.toISOString()
    }, req);
    
    console.log(`✅ Создана новая точка: ${name} (ID: ${pointId})`);
    res.json(newPoint);
  } catch (error) {
    console.error('❌ Ошибка создания точки:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Удалить точку (админ) - ИСПРАВЛЕНО
app.delete('/api/admin/points/:id', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_DELETE_DENIED', { 
        ip: req.ip,
        pointId: req.params.id,
        headers: {
          authorization: req.headers.authorization ? 'present' : 'missing',
          xAdminPassword: req.headers['x-admin-password'] ? 'present' : 'missing'
        }
      }, req);
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const { id } = req.params;
    const deletedPoint = await ModelPoint.findOneAndDelete({ id: id.trim() });
    
    if (!deletedPoint) {
      return res.status(404).json({ error: 'Point not found' });
    }

    logUserAction('ADMIN_POINT_DELETED', { 
      pointId: id, 
      pointName: deletedPoint.name 
    }, req);
    
    console.log(`🗑️ Точка удалена: ${deletedPoint.name} (ID: ${id})`);
    res.json({ success: true, message: 'Point deleted successfully' });
  } catch (error) {
    console.error('❌ Ошибка удаления точки:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// Получить топ коллекторов (для админа) - ИСПРАВЛЕНО
app.get('/api/admin/top-collectors', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const topCollectors = await ModelPoint.aggregate([
      { $match: { status: 'collected' } },
      {
        $group: {
          _id: {
            name: '$collectorInfo.name',
            telegramId: '$collectorInfo.telegramData.id',
            authMethod: '$collectorInfo.authMethod'
          },
          count: { $sum: 1 },
          lastCollection: { $max: '$collectedAt' },
          firstCollection: { $min: '$collectedAt' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    logUserAction('ADMIN_TOP_COLLECTORS_VIEWED', { count: topCollectors.length }, req);
    res.json(topCollectors);
  } catch (error) {
    console.error('❌ Ошибка получения топа коллекторов:', error);
    res.status(500).json({ error: 'Failed to get top collectors' });
  }
});

// Получить расширенную статистику - ИСПРАВЛЕНО
app.get('/api/admin/stats', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const now = new Date();
    const stats = await ModelPoint.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          collected: {
            $sum: {
              $cond: [{ $eq: ['$status', 'collected'] }, 1, 0]
            }
          },
          available: {
            $sum: {
              $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
            }
          },
          scheduled: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'available'] },
                    { $gt: ['$scheduledTime', now] }
                  ]
                },
                1,
                0
              ]
            }
          },
          manualAuth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'collected'] },
                    { $eq: ['$collectorInfo.authMethod', 'manual'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          telegramAuth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'collected'] },
                    { $eq: ['$collectorInfo.authMethod', 'telegram'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          withSelfie: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'collected'] },
                    { $ne: ['$collectorInfo.selfie', null] },
                    { $ne: ['$collectorInfo.selfie', ''] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      collected: 0,
      available: 0,
      scheduled: 0,
      manualAuth: 0,
      telegramAuth: 0,
      withSelfie: 0
    };

    // Дополнительная статистика
    const recentCollections = await ModelPoint.find({
      status: 'collected',
      collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).countDocuments();

    result.recentCollections = recentCollections;

    logUserAction('ADMIN_STATS_VIEWED', result, req);
    console.log(`📊 Статистика загружена: ${result.total} всего, ${result.collected} собрано`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Получить активность по дням - ИСПРАВЛЕНО
app.get('/api/admin/activity', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const { days = 7 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    const activity = await ModelPoint.aggregate([
      {
        $match: {
          $or: [
            { createdAt: { $gte: daysAgo } },
            { collectedAt: { $gte: daysAgo } }
          ]
        }
      },
      {
        $facet: {
          created: [
            { $match: { createdAt: { $gte: daysAgo } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          collected: [
            { 
              $match: { 
                status: 'collected',
                collectedAt: { $gte: daysAgo } 
              } 
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$collectedAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    logUserAction('ADMIN_ACTIVITY_VIEWED', { days: parseInt(days) }, req);
    res.json(activity[0]);
  } catch (error) {
    console.error('❌ Ошибка получения активности:', error);
    res.status(500).json({ error: 'Failed to get activity data' });
  }
});

// Экспорт данных (админ) - ИСПРАВЛЕНО
app.get('/api/admin/export', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const { format = 'json' } = req.query;
    
    const points = await ModelPoint.find({})
      .select('-qrSecret -collectorInfo.telegramData.hash')
      .lean()
      .exec();

    logUserAction('ADMIN_DATA_EXPORTED', { 
      format, 
      pointsCount: points.length 
    }, req);

    if (format === 'csv') {
      // Простой CSV экспорт
      const csvHeader = 'ID,Name,Status,Created,Collected,Collector,AuthMethod,Lat,Lng\n';
      const csvData = points.map(point => {
        return [
          point.id,
          `"${point.name}"`,
          point.status,
          point.createdAt?.toISOString() || '',
          point.collectedAt?.toISOString() || '',
          `"${point.collectorInfo?.name || ''}"`,
          point.collectorInfo?.authMethod || '',
          point.coordinates.lat,
          point.coordinates.lng
        ].join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="plasticboy-export.csv"');
      res.send(csvHeader + csvData);
    } else {
      res.json({
        exportDate: new Date().toISOString(),
        totalPoints: points.length,
        data: points
      });
    }
  } catch (error) {
    console.error('❌ Ошибка экспорта данных:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});
