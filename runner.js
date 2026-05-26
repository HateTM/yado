#!/usr/bin/env node
/**
 * Главный скрипт Cline
 * Поддерживает команды: --deploy, --scan, --upload-rrl
 */

const fs = require('fs/promises');
const path = require('path');

const COMMANDS = {
    deploy: require('./runner_deploy.js'),
    scan: require('./runner_scan.js'),
    uploadRRL: require('./runner_upload_rrl.js')
};

async function run(args) {
    const command = args[0];
    const pathArg = args[1];

    console.log(`\n🚀 Cline v1.0.0\n`);

    if (!COMMANDS[command]) {
        console.error(`   ❌ Неизвестная команда: ${command}`);
        console.log(`\nДоступные команды:\n   --deploy\n   --scan\n   --upload-rrl\n`);
        process.exit(1);
    }

    console.log(`   📋 Команда: ${command}\n`);
    try {
        await COMMANDS[command](pathArg, { sourceOldPaths: 'data-analysis' });
    } catch (error) {
        console.error(`   ❌ Ошибка: ${error.message}`);
        process.exit(1);
    }
}

run(process.argv.slice(2));