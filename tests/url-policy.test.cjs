const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createUrlPolicy } = require('../lib/url-policy');

const site = 'https://s.kaoshibao.com';
const policy = createUrlPolicy(site + '/student/113103');

test('all window routes enforce the same HTTPS origin and reject credentials', () => {
    for (const base of ['http://s.kaoshibao.com', 'https://s.kaoshibao.com:8443',
        'https://s.kaoshibao.com.attacker.com', 'https://other.kaoshibao.com',
        'https://user:password@s.kaoshibao.com']) {
        for (const route of ['/student/113103', '/kaoshi/paper/check/', '/k/123?code=dynamic']) {
            assert.equal(policy.isAllowedUrl(base + route), false);
            assert.equal(policy.getWindowKind(base + route), null);
        }
    }
    for (const url of ['javascript:alert(1)', 'file:///C:/file', 'invalid', '/relative']) {
        assert.equal(policy.isAllowedUrl(url), false);
    }
});

test('preserves paper, score and ordinary window classification', () => {
    for (const suffix of ['', '/']) {
        assert.equal(policy.getWindowKind(site + '/kaoshi/paper/check' + suffix + '?id=1'), 'paper');
        assert.equal(policy.getWindowKind(site + '/k/123' + suffix + '?code=1'), 'score');
    }
    assert.equal(policy.getWindowKind(site + '/kaoshi/paper/check-other'), 'child');
    assert.equal(policy.getWindowKind(site + '/k/not-a-number'), 'child');
    assert.equal(policy.getWindowKind(site + '/student/113103'), 'child');
    assert.equal(policy.isAllowedUrl(site + ':443/k/123'), true);
    assert.equal(policy.isLoginUrl(site + '/student-evil'), false);
});

test('invalid insecure site configuration fails explicitly', () => {
    assert.throws(() => createUrlPolicy('http://example.com'));
    assert.throws(() => createUrlPolicy('https://user@example.com'));
});
