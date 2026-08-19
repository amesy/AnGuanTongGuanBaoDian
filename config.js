'use strict';

const protocol =
    'https://';

const hostParts = [
    's',
    'kaoshibao',
    'com'
];

const host =
    hostParts.join('.');

const pathParts = [
    'student',
    '113103'
];

const websiteUrl =
    protocol +
    host +
    '/' +
    pathParts.join('/');

module.exports = {
    websiteUrl
};