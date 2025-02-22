const Notification = require('../../lib/notification');
const sinon = require('sinon');

describe('Notification', function () {
  let note;
  beforeEach(function () {
    note = new Notification();
  });

  describe('constructor', function () {
    it('accepts initialization values', function () {
      const properties = { priority: 5, topic: 'io.apn.node', payload: { foo: 'bar' }, badge: 5 };
      note = new Notification(properties);

      expect(note.payload).to.deep.equal({ foo: 'bar' });
      expect(note.priority).to.equal(5);
      expect(note.topic).to.equal('io.apn.node');
      expect(compiledOutput()).to.have.nested.deep.property('aps.badge', 5);
    });

    it('no initialization values', function () {
      expect(note.compile()).to.equal('{}');
      expect(compiledOutput()).to.be.empty;
    });
  });

  describe('rawPayload', function () {
    it('is used as the JSON output', function () {
      const payload = { some: 'payload' };
      note = new Notification({ rawPayload: payload });

      expect(note.rawPayload).to.deep.equal({ some: 'payload' });
      expect(compiledOutput()).to.deep.equal({ some: 'payload' });
    });

    it('does not get clobbered by aps accessors', function () {
      const payload = { some: 'payload', aps: { alert: 'Foo' } };

      note = new Notification({ rawPayload: payload });
      note.alertBody = 'Bar';

      expect(note.rawPayload).to.deep.equal({ some: 'payload', aps: { alert: 'Foo' } });
      expect(compiledOutput()).to.deep.equal({ some: 'payload', aps: { alert: 'Foo' } });
    });

    it('takes precedence over the `mdm` property', function () {
      const payload = { some: 'payload' };

      note = new Notification({ rawPayload: payload });
      note.mdm = 'abcd';

      expect(note.rawPayload).to.deep.equal({ some: 'payload' });
      expect(compiledOutput()).to.deep.equal({ some: 'payload' });
    });

    context('when passed in the notification constructor', function () {
      beforeEach(function () {
        note = new Notification({
          rawPayload: { foo: 'bar', baz: 1, aps: { badge: 1, alert: 'Hi there!' } },
        });
      });

      it('contains all original payload properties', function () {
        expect(compiledOutput()).to.have.property('foo', 'bar');
        expect(compiledOutput()).to.have.property('baz', 1);
      });

      it('contains the correct aps properties', function () {
        expect(compiledOutput()).to.have.nested.deep.property('aps.badge', 1);
        expect(compiledOutput()).to.have.nested.deep.property('aps.alert', 'Hi there!');
      });
    });
  });

  describe('payload', function () {
    describe('when no aps properties are set', function () {
      it('contains all original payload properties', function () {
        note.payload = { foo: 'bar', baz: 1 };
        expect(compiledOutput()).to.eql({ foo: 'bar', baz: 1 });
      });
    });

    describe('when aps properties are given by setters', function () {
      it('should not mutate the originally given paylaod object', function () {
        const payload = { foo: 'bar', baz: 1 };
        note.payload = payload;
        note.badge = 1;
        note.sound = 'ping.aiff';
        note.toJSON();
        expect(payload).to.deep.equal({ foo: 'bar', baz: 1 });
      });
    });

    describe('when aps payload is present', function () {
      beforeEach(function () {
        note.payload = { foo: 'bar', baz: 1, aps: { badge: 1, alert: 'Hi there!' } };
      });

      it('contains all original payload properties', function () {
        expect(compiledOutput()).to.have.property('foo', 'bar');
        expect(compiledOutput()).to.have.property('baz', 1);
      });

      it('does not contain the aps properties', function () {
        expect(compiledOutput()).to.not.have.property('aps');
      });
    });
  });

  describe('length', function () {
    it('returns the correct payload length', function () {
      note.alert = 'length';
      expect(note.length()).to.equal(26);
    });
  });

  describe('addPushTypeToPayloadIfNeeded', function () {
    it('add liveactivity push-type to payload when it is missing', function () {
      note.addPushTypeToPayloadIfNeeded();

      expect(note.payload).to.deep.equal({ 'push-type': 'liveactivity' });
    });

    it('do not overwrite push-type if it is already present', function () {
      note.payload['push-type'] = 'alert';
      note.addPushTypeToPayloadIfNeeded();

      expect(note.payload).to.deep.equal({ 'push-type': 'alert' });
    });

    it('do not add push-type if rawPayload is present', function () {
      const payload = { some: 'payload' };
      note = new Notification({ rawPayload: payload });
      note.addPushTypeToPayloadIfNeeded();

      expect(note.rawPayload).to.deep.equal({ some: 'payload' });
      expect(compiledOutput()).to.deep.equal({ some: 'payload' });
    });
  });

  describe('removeNonChannelRelatedProperties', function () {
    it('headers only contains channel related properties', function () {
      note.priority = 5;
      note.id = '123e4567-e89b-12d3-a456-42665544000';
      note.pushType = 'alert';
      note.expiry = 1000;
      note.topic = 'io.apn.node';
      note.collapseId = 'io.apn.collapse';
      note.requestId = 'io.apn.request';
      note.channelId = 'io.apn.channel';
      note.pushType = 'liveactivity';
      note.removeNonChannelRelatedProperties();

      expect(note.headers()).to.deep.equal({
        'apns-channel-id': 'io.apn.channel',
        'apns-expiration': 1000,
        'apns-request-id': 'io.apn.request',
      });
    });
  });

  describe('headers', function () {
    it('contains no properties by default', function () {
      expect(note.headers()).to.deep.equal({});
    });

    context('priority is non-default', function () {
      it('contains the apns-priority header', function () {
        note.priority = 5;
        expect(note.headers()).to.have.property('apns-priority', 5);
      });
    });

    context('id is set', function () {
      it('contains the apns-id header', function () {
        note.id = '123e4567-e89b-12d3-a456-42665544000';

        expect(note.headers()).to.have.property('apns-id', '123e4567-e89b-12d3-a456-42665544000');
      });
    });

    context('expiry is greater than zero', function () {
      it('contains the apns-expiration header', function () {
        note.expiry = 1000;

        expect(note.headers()).to.have.property('apns-expiration', 1000);
      });
    });

    context('expiry is zero', function () {
      it('contains the apns-expiration header', function () {
        note.expiry = 0;

        expect(note.headers()).to.have.property('apns-expiration', 0);
      });
    });

    context('expiry is negative', function () {
      it('not contains the apns-expiration header', function () {
        note.expiry = -1;

        expect(note.headers()).to.not.have.property('apns-expiration');
      });
    });

    context('topic is set', function () {
      it('contains the apns-topic header', function () {
        note.topic = 'io.apn.node';

        expect(note.headers()).to.have.property('apns-topic', 'io.apn.node');
      });
    });

    context('collapseId is set', function () {
      it('contains the apns-collapse-id header', function () {
        note.collapseId = 'io.apn.collapse';

        expect(note.headers()).to.have.property('apns-collapse-id', 'io.apn.collapse');
      });
    });

    context('requestId is set', function () {
      it('contains the apns-request-id header', function () {
        note.requestId = 'io.apn.request';

        expect(note.headers()).to.have.property('apns-request-id', 'io.apn.request');
      });
    });

    context('channelId is set', function () {
      it('contains the apns-request-id header', function () {
        note.channelId = 'io.apn.channel';

        expect(note.headers()).to.have.property('apns-channel-id', 'io.apn.channel');
      });
    });

    context('pushType is set', function () {
      it('contains the apns-push-type header', function () {
        note.pushType = 'alert';

        expect(note.headers()).to.have.property('apns-push-type', 'alert');
      });
    });
  });

  describe('compile', function () {
    let stub;
    beforeEach(function () {
      stub = sinon.stub(note, 'toJSON');
    });

    it('compiles the JSON payload', function () {
      stub.returns('payload');

      expect(note.compile()).to.equal('"payload"');
    });

    it('returns the JSON payload', function () {
      stub.returns({});

      expect(note.compile()).to.equal('{}');
    });

    it('memoizes the JSON payload', function () {
      stub.returns('payload1');
      note.compile();

      stub.returns('payload2');

      expect(note.compile()).to.equal('"payload1"');
    });

    it('re-compiles the JSON payload when `note.compiled` = false', function () {
      stub.returns('payload1');
      note.compile();

      stub.returns('payload2');
      note.compiled = false;

      expect(note.compile()).to.equal('"payload2"');
    });
  });

  function compiledOutput() {
    return JSON.parse(note.compile());
  }
});
